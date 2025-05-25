/**
 * DHG Audio Auth Service
 * 
 * A thin wrapper around the shared light-auth-enhanced-service
 * Provides app-specific authentication logic while using shared services
 * 
 * This replaces the multiple auth service files with a single clean implementation
 */

import type { ProfileFormData as ComponentProfileFormData } from '@shared/components/profile/ProfileForm';
import type { User } from '@supabase/supabase-js';
import { waitForEnvironment } from './env-check';

// Lazy load the enhanced service to avoid initialization issues
let lightAuthEnhancedInstance: any = null;
type ServiceProfileFormData = any; // Will be properly typed from dynamic import

async function getLightAuthEnhanced() {
  if (!lightAuthEnhancedInstance) {
    // Wait for environment to be ready
    const envReady = await waitForEnvironment();
    if (!envReady) {
      throw new Error('Environment not initialized');
    }
    
    // Dynamic import to avoid module initialization issues
    const module = await import('@shared/services/light-auth-enhanced-service');
    lightAuthEnhancedInstance = module.lightAuthEnhanced;
  }
  return lightAuthEnhancedInstance;
}

// Re-export types for backward compatibility
export type LightAuthUser = User;
export type ProfileFormData = ComponentProfileFormData;

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
function convertToServiceProfile(componentProfile: ComponentProfileFormData): ServiceProfileFormData {
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

/**
 * DHG Audio Authentication Service
 * Uses the enhanced shared auth service for all operations
 */
class DhgAudioAuthService {
  private static instance: DhgAudioAuthService;
  private readonly STORAGE_KEY = 'dhg_auth_user';

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DhgAudioAuthService {
    if (!DhgAudioAuthService.instance) {
      DhgAudioAuthService.instance = new DhgAudioAuthService();
    }
    return DhgAudioAuthService.instance;
  }

  /**
   * Login with email
   */
  async login(email: string): Promise<LightAuthResult> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      const result = await lightAuthEnhanced.login(email);
      
      // Save to localStorage with app-specific key
      if (result.success && result.user) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.user));
      }

      return {
        success: result.success,
        user: result.user,
        error: result.error,
        needsProfile: result.needsProfile
      };
    } catch (error) {
      console.error('Login error in dhg-audio-auth-service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication service initialization failed'
      };
    }
  }

  /**
   * Register with profile (for non-whitelisted users)
   */
  async registerWithProfile(email: string, name: string, profile: ComponentProfileFormData): Promise<LightAuthResult> {
    const lightAuthEnhanced = await getLightAuthEnhanced();
    const result = await lightAuthEnhanced.registerWithProfile({
      email,
      name,
      profile: convertToServiceProfile(profile)
    });

    // Save to localStorage with app-specific key
    if (result.success && result.user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.user));
    }

    return {
      success: result.success,
      user: result.user,
      error: result.error,
      needsProfile: false
    };
  }

  /**
   * Complete profile for whitelisted user
   */
  async completeProfile(userId: string, profile: ComponentProfileFormData): Promise<boolean> {
    console.log('[dhg-audio-auth-service] completeProfile called with userId:', userId);
    console.log('[dhg-audio-auth-service] profile data:', profile);
    
    const lightAuthEnhanced = await getLightAuthEnhanced();
    const serviceProfile = convertToServiceProfile(profile);
    console.log('[dhg-audio-auth-service] converted profile:', serviceProfile);
    
    const success = await lightAuthEnhanced.completeProfile(userId, serviceProfile);
    
    if (success) {
      // Update localStorage to reflect profile completion
      const user = this.getCurrentUser();
      if (user) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      }
    }

    return success;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    // Don't use shared service for getCurrentUser to avoid async issues
    // Just use localStorage directly
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to parse stored user:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      await lightAuthEnhanced.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      return await lightAuthEnhanced.getUserProfile(userId);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: 'Failed to load profile' };
    }
  }

  /**
   * Check if onboarding is complete
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const lightAuthEnhanced = await getLightAuthEnhanced();
    return lightAuthEnhanced.hasCompletedOnboarding(userId);
  }
}

// Export singleton instance
export const dhgAudioAuth = DhgAudioAuthService.getInstance();