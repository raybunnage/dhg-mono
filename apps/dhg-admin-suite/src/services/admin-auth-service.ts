/**
 * Admin Auth Service
 * Uses real Supabase authentication with app_metadata for admin roles
 */

import { browserAuthService } from '../lib/auth-init';
import { supabase } from '../lib/supabase';

/**
 * Check if the current user is an admin using app_metadata
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    // Check app_metadata for admin role
    return user.app_metadata?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get admin metadata from current user
 */
export async function getAdminMetadata(): Promise<any> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    return user.app_metadata || null;
  } catch (error) {
    console.error('Error getting admin metadata:', error);
    return null;
  }
}

// Re-export from the initialized service
export { browserAuthService };
export * from '@shared/services/auth-service/browser';