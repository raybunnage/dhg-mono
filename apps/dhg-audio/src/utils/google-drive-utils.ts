/**
 * Utility functions for working with Google Drive URLs
 * Uses the dedicated audio proxy server to bypass browser restrictions
 */

/**
 * Extract Drive ID from web_view_link URL
 */
export const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

/**
 * Get the audio proxy server URL based on environment
 */
export const getAudioProxyBaseUrl = (): string => {
  // Check if we're in development (has Vite dev server)
  if (import.meta.env.DEV) {
    return 'http://localhost:3006'; // Audio proxy server port from CLAUDE.md
  }
  
  // In production, use the same origin (server handles both static files and API)
  return window.location.origin;
};

/**
 * Convert web_view_link to proxy URL that bypasses browser restrictions
 * This uses our dedicated audio proxy server with Google Drive service account
 */
export const getAudioProxyUrl = (webViewLink: string | null): string | null => {
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return null;
  
  const baseUrl = getAudioProxyBaseUrl();
  return `${baseUrl}/api/audio/${driveId}`;
};

/**
 * Get preview URL for Google Drive files (for manual fallback)
 */
export const getGoogleDrivePreviewUrl = (webViewLink: string | null): string | null => {
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return null;
  
  return `https://drive.google.com/file/d/${driveId}/preview`;
};

/**
 * Get direct download URL for Google Drive files (for manual fallback)
 */
export const getGoogleDriveDownloadUrl = (webViewLink: string | null): string | null => {
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return null;
  
  return `https://drive.google.com/uc?export=download&id=${driveId}`;
};

/**
 * Get audio URL options prioritizing the proxy server
 * Returns array of URLs to try in order of preference
 */
export const getAudioUrlOptions = (webViewLink: string | null): string[] => {
  if (!webViewLink) return [];
  
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return [webViewLink];
  
  const proxyUrl = getAudioProxyUrl(webViewLink);
  const downloadUrl = getGoogleDriveDownloadUrl(webViewLink);
  const previewUrl = getGoogleDrivePreviewUrl(webViewLink);
  
  // Prioritize proxy server, then direct URLs, then original as fallback
  const options = [];
  if (proxyUrl) options.push(proxyUrl);
  if (downloadUrl) options.push(downloadUrl);
  if (previewUrl) options.push(previewUrl);
  options.push(webViewLink); // Original as final fallback
  
  return options;
};