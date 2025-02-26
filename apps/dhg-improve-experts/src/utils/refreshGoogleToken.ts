import { supabase } from '@/integrations/supabase/client';

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  token_type: string;
}

/**
 * Refreshes the Google OAuth token using the stored refresh token
 * @returns Promise with the refreshed token data
 */
export async function refreshGoogleToken(): Promise<{
  success: boolean;
  expires_at?: string;
  access_token?: string;
  error?: string;
}> {
  try {
    // Get the current refresh token from local storage or your preferred storage method
    const storedToken = localStorage.getItem('google_refresh_token');
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    
    if (!storedToken) {
      return { 
        success: false, 
        error: 'No refresh token found' 
      };
    }
    
    // Make the token refresh request
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: storedToken,
        grant_type: 'refresh_token',
      }),
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
    const expiresIn = data.expires_in || 3600; // Default to 1 hour if not provided
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
    
    // Store the new token
    localStorage.setItem('google_access_token', data.access_token);
    localStorage.setItem('google_token_expires_at', expiresAt.toISOString());
    
    // Optional: Store in Supabase if you want to keep it synchronized
    if (supabase) {
      try {
        await supabase.from('google_auth_tokens').insert({
          access_token: data.access_token,
          refresh_token: storedToken, // Keep using the same refresh token
          expires_at: expiresAt.toISOString(),
          token_type: data.token_type || 'Bearer',
        });
      } catch (dbError) {
        console.error('Error storing token in database:', dbError);
        // Continue anyway since we have the token in localStorage
      }
    }
    
    return {
      success: true,
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return {
      success: false,
      error: error.message,
    };
  }
} 