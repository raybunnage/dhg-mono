/**
 * Enhanced Google Drive utilities for dhg-audio
 * Now uses the shared GoogleDriveService with audio utilities
 */

import { GoogleDriveService, type AudioUrlOptions, type AudioProxyConfig } from '@shared/services/google-drive/google-drive-service';

// Re-export all the static methods from GoogleDriveService for backward compatibility
export const extractDriveId = GoogleDriveService.extractDriveId;
export const getGoogleDrivePreviewUrl = GoogleDriveService.getGoogleDrivePreviewUrl;
export const getGoogleDriveDownloadUrl = GoogleDriveService.getGoogleDriveDownloadUrl;
export const getAudioUrlOptions = GoogleDriveService.getAudioUrlOptions;

// Enhanced methods with dhg-audio specific configuration
const audioConfig: AudioProxyConfig = {
  isDevelopment: import.meta.env.DEV
};

/**
 * Get the audio proxy server URL (dhg-audio specific)
 */
export const getAudioProxyBaseUrl = (): string => {
  return GoogleDriveService.getAudioProxyBaseUrl(audioConfig);
};

/**
 * Convert web_view_link to proxy URL (dhg-audio specific)
 */
export const getAudioProxyUrl = (webViewLink: string | null): string | null => {
  return GoogleDriveService.getAudioProxyUrl(webViewLink, audioConfig);
};

/**
 * Get audio URL options with dhg-audio configuration
 */
export const getAudioUrlOptionsForDhgAudio = (webViewLink: string | null): string[] => {
  return GoogleDriveService.getAudioUrlOptions(webViewLink, audioConfig);
};

/**
 * Get structured audio URL options object with dhg-audio configuration
 */
export const getAudioUrlOptionsObject = (webViewLink: string | null): AudioUrlOptions => {
  return GoogleDriveService.getAudioUrlOptionsObject(webViewLink, audioConfig);
};

// Export types for convenience
export type { AudioUrlOptions, AudioProxyConfig };