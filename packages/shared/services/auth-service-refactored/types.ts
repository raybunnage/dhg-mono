/**
 * Authentication Service Type Definitions
 * 
 * Defines all types used by the authentication service
 */

import { Session, User, AuthError } from '@supabase/supabase-js';

/**
 * Extended user type with application-specific fields
 */
export interface AppUser extends User {
  profile?: UserProfile;
  roles?: string[];
  permissions?: string[];
}

/**
 * User profile information stored in user_profiles table
 */
export interface UserProfile {
  id: string;
  full_name?: string;
  preferences?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Authentication session with additional metadata
 */
export interface AuthSession extends Session {
  user: AppUser;
  environment?: 'cli' | 'web';
  metadata?: Record<string, any>;
}

/**
 * CLI authentication token
 */
export interface CLIAuthToken {
  id: string;
  user_id: string;
  token_hash: string;
  name: string;
  last_used?: string;
  expires_at?: string;
  created_at: string;
}

/**
 * Authentication event for audit logging
 */
export interface AuthEvent {
  id?: string;
  user_id?: string;
  event_type: AuthEventType;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

/**
 * Types of authentication events
 */
export type AuthEventType = 
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'token_created'
  | 'token_revoked'
  | 'password_changed'
  | 'profile_updated'
  | 'session_refreshed';

/**
 * User profile update payload
 */
export interface UserProfileUpdate {
  full_name?: string;
  preferences?: Record<string, any>;
}

/**
 * Authentication options
 */
export interface AuthOptions {
  environment?: 'cli' | 'web';
  persistSession?: boolean;
  autoRefreshToken?: boolean;
}

/**
 * Sign up options
 */
export interface SignUpOptions extends AuthOptions {
  emailRedirectTo?: string;
  data?: Record<string, any>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  session: AuthSession | null;
  user: AppUser | null;
  error: AuthError | null;
}

/**
 * Magic link options
 */
export interface MagicLinkOptions {
  email: string;
  redirectTo?: string;
  shouldCreateUser?: boolean;
}

/**
 * OAuth provider options
 */
export interface OAuthOptions {
  provider: 'google' | 'github' | 'gitlab';
  redirectTo?: string;
  scopes?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheck {
  hasPermission: boolean;
  permission: string;
  user_id: string;
  checked_at: string;
}

/**
 * Service account credentials
 */
export interface ServiceAccountCredentials {
  email: string;
  key: string;
}

/**
 * Access request data for email allowlist
 */
export interface AccessRequestData {
  email: string;
  name: string;
  profession?: string;
  professional_interests?: string;
  organization?: string;
  reason_for_access?: string;
}

/**
 * Access request database record
 */
export interface AccessRequest {
  id: string;
  email: string;
  name: string;
  profession?: string;
  professional_interests?: string;
  organization?: string;
  reason_for_access?: string;
  request_date: string;
  approved: boolean;
  approved_at?: string;
  approved_by?: string;
  denied: boolean;
  denied_at?: string;
  denied_by?: string;
  denial_reason?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Allowed email database record
 */
export interface AllowedEmail {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  added_at: string;
  added_by?: string;
  notes?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
}

/**
 * Authentication summary for a user
 */
export interface AuthSummary {
  totalLogins: number;
  totalFailedAttempts: number;
  lastLoginAt: string | null;
  tokensCreated: number;
  profileUpdates: number;
  recentActivity: AuthEvent[];
}

/**
 * System-wide authentication statistics
 */
export interface SystemAuthStats {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  totalLogins: number;
  totalFailedAttempts: number;
  topEventTypes: Array<{ event_type: string; count: number }>;
}

/**
 * Audit log cleanup result
 */
export interface AuditLogCleanupResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

/**
 * Audit log export result
 */
export interface AuditLogExportResult {
  success: boolean;
  data?: AuthEvent[];
  error?: string;
}