/**
 * Type definitions for UserProfileService (Refactored)
 */

import { Database } from '../../../../supabase/types';

type UserProfile = Database['public']['Tables']['auth_user_profiles']['Row'];

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

export interface ProfileStats {
  completeness: number;
  topicsCount: number;
  goalsCount: number;
  lastActivity: string | null;
}

// NEW TYPES FOR REFACTORED SERVICE

export interface UserProfileServiceMetrics {
  profilesCreated: number;
  profilesUpdated: number;
  profilesRetrieved: number;
  profileLookupsFailed: number;
  profileSavesFailed: number;
  onboardingCompletions: number;
  recommendationsGenerated: number;
  averageProfileCompleteness: number;
  totalProfileCompleteness: number;
  profileCompletenessCount: number;
  errors: number;
}