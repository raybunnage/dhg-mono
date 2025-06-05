import { refreshGoogleToken } from '../api/auth';

export async function getValidAccessToken() {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const refreshToken = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
  
  try {
    // First try with current access token
    const response = await fetch('https://www.googleapis.com/drive/v3/about', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      return accessToken;
    }

    // If 401, refresh the token
    if (response.status === 401) {
      const newToken = await refreshGoogleToken(refreshToken);
      return newToken;
    }

    throw new Error(`Token validation failed: ${response.status}`);
  } catch (error) {
    console.error('Error validating/refreshing token:', error);
    throw error;
  }
} 