/**
 * React Authentication Hook for DHG Audio
 * 
 * Provides light authentication state and methods for React components
 * Uses the new dhg-audio-auth-service which wraps the shared enhanced auth service
 */

import { useState, useEffect, useCallback } from 'react';
import { lightAuthBrowserService, type LightAuthResult } from '../services/light-auth-browser-service';
import type { User as LightAuthUser } from '@supabase/supabase-js';
import type { ProfileFormData } from '@shared/services/user-profile-service';

/**
 * Authentication hook state
 */
interface AuthState {
  user: LightAuthUser | null;
  loading: boolean;
  error: Error | null;
  needsProfile: boolean;
  profileCompleteness?: number;
}

/**
 * Authentication hook return type
 */
interface UseAuthReturn extends AuthState {
  login: (email: string) => Promise<LightAuthResult>;
  logout: () => Promise<void>;
  completeProfile: (profile: ProfileFormData) => Promise<boolean>;
  registerWithProfile: (email: string, name: string, profile: ProfileFormData) => Promise<LightAuthResult>;
}

/**
 * React hook for light authentication
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    needsProfile: false
  });

  // Initialize authentication state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[useAuth] Initializing auth...');
        const currentUser = lightAuthBrowserService.getCurrentUser();
        console.log('[useAuth] Current user from auth service:', currentUser);
        
        // Also check localStorage directly
        const storedUser = localStorage.getItem('dhg_auth_user');
        console.log('[useAuth] User in localStorage:', storedUser ? 'exists' : 'null');
        
        if (currentUser && mounted) {
          // For now, skip the async profile check during navigation
          // Just set the user and assume profile is complete
          console.log('[useAuth] Setting user state immediately');
          setState({
            user: currentUser,
            loading: false,
            error: null,
            needsProfile: false,
            profileCompleteness: 100
          });
          
          // Then check profile completion in the background
          lightAuthBrowserService.hasCompletedOnboarding(currentUser.id)
            .then(hasProfile => {
              console.log('[useAuth] Profile check result:', hasProfile);
              if (mounted) {
                setState(prev => ({
                  ...prev,
                  needsProfile: !hasProfile,
                  profileCompleteness: hasProfile ? 100 : 0
                }));
              }
            })
            .catch(profileError => {
              console.warn('[useAuth] Could not check profile completion:', profileError);
              // Don't update state on error - keep the user logged in
            });
        } else if (mounted) {
          console.log('[useAuth] No user found, setting as logged out');
          setState({
            user: null,
            loading: false,
            error: null,
            needsProfile: false
          });
        }
      } catch (error) {
        console.error('[useAuth] Auth initialization error:', error);
        if (mounted) {
          // Don't show error to user for initialization issues
          // Just set as not logged in
          setState({
            user: null,
            loading: false,
            error: null,
            needsProfile: false
          });
        }
      }
    };

    // Listen for storage events to detect auth changes
    const handleStorageChange = () => {
      console.log('[useAuth] Storage change detected, reinitializing auth');
      initializeAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    initializeAuth();

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Login method
  const login = useCallback(async (email: string): Promise<LightAuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('Attempting login with email:', email);
      const result = await lightAuthBrowserService.login(email);
      console.log('Login result:', result);
      
      if (!result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error(result.error || 'Authentication failed'),
          needsProfile: result.needsProfile || false
        }));
      } else {
        const needsProfile = result.needsProfile || false;
        
        setState({
          user: result.user || null,
          loading: false,
          error: null,
          needsProfile,
          profileCompleteness: needsProfile ? 0 : 100
        });
        
        // Force a re-render by updating localStorage event
        window.dispatchEvent(new Event('storage'));
      }
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { success: false, error: err.message };
    }
  }, []);

  // Register with profile method
  const registerWithProfile = useCallback(async (email: string, name: string, profile: ProfileFormData): Promise<LightAuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await lightAuthBrowserService.registerWithProfile({ email, name, profile });
      
      if (result.success && result.user) {
        setState({
          user: result.user,
          loading: false,
          error: null,
          needsProfile: false,
          profileCompleteness: 100
        });
        
        // Force a re-render
        window.dispatchEvent(new Event('storage'));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error(result.error || 'Registration failed')
        }));
      }
      
      return result;
    } catch (error) {
      console.error('Registration error:', error);
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { success: false, error: err.message };
    }
  }, []);

  // Complete profile method
  const completeProfile = useCallback(async (profile: ProfileFormData): Promise<boolean> => {
    // Get current user from auth service in case state hasn't updated yet
    const currentUser = state.user || lightAuthBrowserService.getCurrentUser();
    
    if (!currentUser) {
      console.error('No user to complete profile for');
      return false;
    }

    console.log('Completing profile for user:', currentUser.id);
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const success = await lightAuthBrowserService.completeProfile(currentUser.id, profile);
      
      if (success) {
        setState(prev => ({
          ...prev,
          loading: false,
          needsProfile: false,
          profileCompleteness: 100
        }));
        
        // Force a re-render
        window.dispatchEvent(new Event('storage'));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error('Failed to complete profile')
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Profile completion error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      return false;
    }
  }, [state.user]);

  // Logout method
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await lightAuthBrowserService.logout();
      setState({
        user: null,
        loading: false,
        error: null,
        needsProfile: false
      });
      
      // Force a re-render by updating localStorage event
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    needsProfile: state.needsProfile,
    profileCompleteness: state.profileCompleteness,
    login,
    logout,
    completeProfile,
    registerWithProfile
  };
}