import { supabase } from '@/integrations/supabase/client';
import { refreshGoogleToken as refreshToken } from '@/utils/refreshGoogleToken';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
].join(' ');

/**
 * Initiates the Google OAuth flow
 */
export const initiateGoogleAuth = () => {
  // Check if we can use the token from environment variables
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const refreshToken = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
  
  if (accessToken) {
    // Store tokens
    localStorage.setItem('google_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('google_refresh_token', refreshToken);
    }
    
    // Set expiration (1 hour from now as default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    // Reload to reflect token state
    window.location.reload();
    return;
  }
  
  // If no token available in env, allow manual entry
  const newToken = prompt('Enter a new Google access token:');
  if (newToken) {
    localStorage.setItem('google_access_token', newToken);
    
    // Set expiration (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    // Force reload to apply the new token
    window.location.reload();
  }
};

/**
 * Handles the OAuth callback and exchanges code for tokens
 */
export const handleGoogleAuthCallback = async (code: string) => {
  console.log('OAuth callback received with code:', code);
  return { success: false, error: 'Full OAuth flow not implemented yet' };
};

/**
 * Check if the user has a valid Google token
 */
export const checkGoogleTokenStatus = async () => {
  try {
    // First try from localStorage (if user manually entered a token)
    let accessToken = localStorage.getItem('google_access_token');
    
    // If not in localStorage, use the one from environment variables
    if (!accessToken) {
      accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      // Store in localStorage for future use
      if (accessToken) {
        localStorage.setItem('google_access_token', accessToken);
        
        // Store refresh token too if available
        const refreshToken = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
        if (refreshToken) {
          localStorage.setItem('google_refresh_token', refreshToken);
        }
        
        // Set expiration (1 hour from now as a fallback)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
      }
    }
    
    if (!accessToken) {
      return { isValid: false, error: 'No access token available' };
    }
    
    // Get expiration time (from localStorage or set a default)
    let expiresAt;
    const expiresAtStr = localStorage.getItem('google_token_expires_at');
    if (expiresAtStr) {
      expiresAt = new Date(expiresAtStr);
    } else {
      // Default expiration is 1 hour from now
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    }
    
    // Verify the token is actually valid by making a test call to Google Drive API
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        // Token might be invalid, try to refresh it
        const refreshResult = await refreshGoogleToken();
        if (!refreshResult.success) {
          return { isValid: false, error: 'Token validation failed' };
        }
        
        // Token refreshed successfully
        expiresAt = new Date(refreshResult.expires_at);
        return {
          isValid: true,
          expiresAt,
          needsRefresh: false
        };
      }
    } catch (error) {
      return { isValid: false, error: 'Token validation failed' };
    }
    
    const now = new Date();
    return {
      isValid: expiresAt > now,
      expiresAt,
      // Consider refresh if less than 5 minutes remaining
      needsRefresh: (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000
    };
  } catch (error) {
    console.error('Error checking token status:', error);
    return { isValid: false, error };
  }
};

/**
 * Refresh the Google token using the refresh token
 */
export const refreshGoogleToken = async () => {
  try {
    // Get refresh token from localStorage or environment
    let refreshToken = localStorage.getItem('google_refresh_token');
    if (!refreshToken) {
      refreshToken = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
    }
    
    if (!refreshToken) {
      return { 
        success: false, 
        error: 'No refresh token available' 
      };
    }
    
    // For OAuth credentials, use environment variables if available
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret || clientId === 'your_client_id') {
      // If no real OAuth credentials, simulate a refresh
      console.log('OAuth credentials not available. Simulating token refresh');
      
      // Get fresh token from env
      const freshToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      if (!freshToken) {
        return {
          success: false,
          error: 'No access token available in environment'
        };
      }
      
      // Update localStorage
      localStorage.setItem('google_access_token', freshToken);
      
      // Set new expiration (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
      
      return {
        success: true,
        access_token: freshToken,
        expires_at: expiresAt.toISOString()
      };
    }
    
    // If we have real OAuth credentials, do a proper refresh
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: `Failed to refresh token: ${JSON.stringify(errorData)}`
      };
    }
    
    const data = await response.json();
    
    // Calculate expiration time
    const expiresIn = data.expires_in || 3600;
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
    
    // Store the new token
    localStorage.setItem('google_access_token', data.access_token);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    return {
      success: true,
      access_token: data.access_token,
      expires_at: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 