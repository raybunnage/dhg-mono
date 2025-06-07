/**
 * Utility functions for working with Google Drive URLs
 */

/**
 * Extract Drive ID from web_view_link URL
 * Based on CLAUDE.md guidance for Google Drive file embedding
 */
export const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

/**
 * Convert web_view_link to preview URL for better browser compatibility
 * This helps avoid CSP restrictions and tracking prevention blocking
 */
export const getGoogleDrivePreviewUrl = (webViewLink: string | null): string | null => {
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return null;
  
  // Use the preview endpoint which works better with browser security policies
  return `https://drive.google.com/file/d/${driveId}/preview`;
};

/**
 * Get direct download URL for Google Drive files
 * This can be used as an alternative for audio files
 */
export const getGoogleDriveDownloadUrl = (webViewLink: string | null): string | null => {
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return null;
  
  // Direct download URL - may work better for audio files
  return `https://drive.google.com/uc?export=download&id=${driveId}`;
};

/**
 * Get multiple URL options for audio files to try in fallback scenarios
 */
export const getAudioUrlOptions = (webViewLink: string | null): string[] => {
  if (!webViewLink) return [];
  
  const driveId = extractDriveId(webViewLink);
  if (!driveId) return [webViewLink];
  
  return [
    // Direct download URL (best for audio)
    `https://drive.google.com/uc?export=download&id=${driveId}`,
    // Preview URL
    `https://drive.google.com/file/d/${driveId}/preview`,
    // Original web view link as fallback
    webViewLink
  ];
};