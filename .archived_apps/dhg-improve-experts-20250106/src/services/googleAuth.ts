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
    
    // Set acquisition time to now
    const acquiredAt = new Date();
    localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
    
    // Set expiration (60 minutes from now to account for token validity)
    const expiresAt = new Date(acquiredAt);
    expiresAt.setMinutes(expiresAt.getMinutes() + 60);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    console.log('Token acquired at:', acquiredAt.toLocaleTimeString());
    console.log('Token expires at:', expiresAt.toLocaleTimeString());
    
    // Reload to reflect token state
    window.location.reload();
    return;
  }
  
  // If no token available in env, allow manual entry
  const newToken = prompt('Enter a new Google access token:');
  if (newToken) {
    localStorage.setItem('google_access_token', newToken);
    
    // Set acquisition time to now
    const acquiredAt = new Date();
    localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
    
    // Set expiration (60 minutes from acquisition time)
    const expiresAt = new Date(acquiredAt);
    expiresAt.setMinutes(expiresAt.getMinutes() + 60);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    console.log('Token entered manually at:', acquiredAt.toLocaleTimeString());
    console.log('Token expires at:', expiresAt.toLocaleTimeString());
    
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
 * Simple function to check if the Google token is valid
 * Returns a boolean indicating if the token is valid
 */
/**
 * Validates a Google access token by making a test API call
 * 
 * @param forceFromEnv If true, will always get the token from env vars (ignoring localStorage)
 * @returns boolean indicating if token is valid
 */
export const isGoogleTokenValid = async (forceFromEnv: boolean = true): Promise<boolean> => {
  try {
    let accessToken: string | undefined;
    let tokenSource: string;
    
    // Prioritize environment variables if forceFromEnv is true
    if (forceFromEnv) {
      accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      tokenSource = 'env vars (forced)';
      
      // If no token in env vars, try localStorage as fallback
      if (!accessToken) {
        accessToken = localStorage.getItem('google_access_token') || undefined;
        tokenSource = 'localStorage (fallback)';
      }
    } else {
      // Standard flow: check localStorage first, then env vars
      accessToken = localStorage.getItem('google_access_token') || undefined;
      tokenSource = 'localStorage';
      
      if (!accessToken) {
        accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
        tokenSource = 'env vars';
      }
    }
    
    // If we got a token from env vars, store it in localStorage for future use
    if (accessToken && tokenSource.includes('env vars')) {
      localStorage.setItem('google_access_token', accessToken);
      console.log('Stored token from env vars in localStorage');
    }
    
    // If no token available from either source, return false
    if (!accessToken) {
      console.log('No Google token available');
      return false;
    }
    
    // Log token details for debugging (safely, not showing the whole token)
    console.log(`Using token from ${tokenSource}`);
    console.log(`Token length: ${accessToken.length}`);
    console.log(`Token starts with: ${accessToken.substring(0, 10)}...`);
    console.log(`Token ends with: ...${accessToken.substring(accessToken.length - 10)}`);
    
    // Make a simple API call to verify the token works
    console.log('Making API test call to Google Drive...');
    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // If response is ok, token is valid
    if (response.ok) {
      console.log('Google token is valid');
      // If token is valid, update localStorage to ensure it has the correct token
      localStorage.setItem('google_access_token', accessToken);
      return true;
    } else {
      console.log('Google token validation failed with status:', response.status);
      
      // Try to get more error details
      try {
        const errorData = await response.json();
        console.error('Error details:', errorData);
      } catch (e) {
        console.log('Could not parse error response');
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error validating Google token:', error);
    return false;
  }
};

/**
 * Check if the user has a valid Google token and test it actually works
 * @deprecated Use isGoogleTokenValid() instead for a simpler approach
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
        
        // Set expiration (59.5 minutes from now as a fallback)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 59);
        expiresAt.setSeconds(expiresAt.getSeconds() + 30);
        localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
        // Also store the token acquisition time
        localStorage.setItem('google_token_acquired_at', new Date().toISOString());
        console.log('Using token from environment, expires at:', expiresAt.toLocaleTimeString());
      }
    }
    
    if (!accessToken) {
      return { isValid: false, error: 'No access token available' };
    }
    
    // Get expiration time from localStorage
    let expiresAt;
    const expiresAtStr = localStorage.getItem('google_token_expires_at');
    // Get token acquisition time from localStorage
    let acquiredAt;
    const acquiredAtStr = localStorage.getItem('google_token_acquired_at');
    
    if (expiresAtStr) {
      expiresAt = new Date(expiresAtStr);
    } else {
      // If no expiration time is stored, we need to set one
      // But first check if we have acquisition time
      if (acquiredAtStr) {
        acquiredAt = new Date(acquiredAtStr);
        // If we have acquisition time, set expiration to 1 hour after acquisition
        expiresAt = new Date(acquiredAt);
        expiresAt.setHours(expiresAt.getHours() + 1);
      } else {
        // If no acquisition time, set both to now
        acquiredAt = new Date();
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        // Store the acquisition time
        localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
      }
      // Store the expiration time
      localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    }
    
    // Check if we should skip validation in dev mode
    const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
    
    if (skipValidation) {
      console.log('DEV MODE: Skipping token validation for better development experience');
      // In dev mode with skip_token_validation = true, we'll assume the token is valid
      // This helps during development when you don't have a real token
      
      // Set acquisition time if needed
      if (!acquiredAtStr) {
        acquiredAt = new Date();
        localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
      } else {
        acquiredAt = new Date(acquiredAtStr);
      }
    } else {
      // Normal mode - verify the token is actually valid with a test API call
      try {
        const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          console.log('Token validation failed with status:', response.status);
          
          // Token is invalid, try to refresh it
          const refreshResult = await refreshGoogleToken();
          if (!refreshResult.success) {
            return { isValid: false, error: 'Token validation failed and refresh failed' };
          }
          
          // Token refreshed successfully
          expiresAt = new Date(refreshResult.expires_at);
          // Set acquisition time to now
          acquiredAt = new Date();
          localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
          
          return {
            isValid: true,
            expiresAt,
            acquiredAt,
            needsRefresh: false,
            wasRefreshed: true
          };
        }
        
        // Token is valid - if we don't have acquisition time, set it now
        if (!acquiredAtStr) {
          acquiredAt = new Date();
          localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
        } else {
          acquiredAt = new Date(acquiredAtStr);
        }
      } catch (error) {
        console.error('Error validating token:', error);
        return { 
          isValid: false, 
          error: 'Token validation request failed',
          details: error.message 
        };
      }
    }
    
    const now = new Date();
    
    // Calculate time elapsed since token acquisition
    const elapsedMs = acquiredAt ? now.getTime() - acquiredAt.getTime() : 0;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    
    // Google tokens typically expire after 60 minutes
    const totalValidityMinutes = 60;
    const remainingMinutes = totalValidityMinutes - elapsedMinutes;
    
    // Calculate the remaining percentage
    const remainingPercentage = Math.max(0, Math.min(100, (remainingMinutes / totalValidityMinutes) * 100));
    
    return {
      isValid: expiresAt > now,
      expiresAt,
      acquiredAt,
      elapsedMinutes,
      remainingMinutes,
      remainingPercentage,
      // Consider refresh if less than 5 minutes remaining or if remaining percentage is less than 10%
      needsRefresh: remainingMinutes < 5 || remainingPercentage < 10
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
      
      // Set new expiration (59.5 minutes from now for simulated refresh)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 59);
      expiresAt.setSeconds(expiresAt.getSeconds() + 30);
      localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
      
      // Store the token acquisition time
      const acquiredAt = new Date();
      localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
      
      console.log('Simulated token refresh, expires at:', expiresAt.toLocaleTimeString());
      
      // Now verify the token actually works with a test API call - unless we're skipping validation
      const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
      
      if (skipValidation) {
        console.log('DEV MODE: Skipping token validation test during refresh');
      } else {
        try {
          const testResponse = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
            headers: {
              'Authorization': `Bearer ${freshToken}`
            }
          });
          
          if (!testResponse.ok) {
            console.error('Token validation failed after refresh with status:', testResponse.status);
            return {
              success: false,
              error: `Token validation failed after refresh: ${testResponse.status}`
            };
          }
          
          console.log('Token is valid - API test successful');
        } catch (testError) {
          console.error('Error testing refreshed token:', testError);
          return {
            success: false,
            error: `Error testing refreshed token: ${testError.message}`
          };
        }
      }
      
      return {
        success: true,
        access_token: freshToken,
        expires_at: expiresAt.toISOString(),
        acquired_at: acquiredAt.toISOString()
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
    
    // Store acquisition time
    const acquiredAt = new Date();
    
    // Store the new token
    localStorage.setItem('google_access_token', data.access_token);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
    
    // Test the refreshed token - unless we're skipping validation
    const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
    
    if (skipValidation) {
      console.log('DEV MODE: Skipping token validation test after OAuth refresh');
    } else {
      try {
        const testResponse = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
        
        if (!testResponse.ok) {
          console.error('Token validation failed after refresh with status:', testResponse.status);
          return {
            success: false,
            error: `Token validation failed after refresh: ${testResponse.status}`
          };
        }
        
        console.log('Refreshed token is valid - API test successful');
      } catch (testError) {
        console.error('Error testing refreshed token:', testError);
        // Don't fail here - the token might still work for other APIs
      }
    }
    
    return {
      success: true,
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
      acquired_at: acquiredAt.toISOString()
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 