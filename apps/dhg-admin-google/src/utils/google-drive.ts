/**
 * Google Drive utilities wrapper
 * 
 * This file wraps the shared Google Drive browser service for backward compatibility
 */

import { googleDriveBrowser } from '@shared/services/google-drive/google-drive-browser-service';

// Re-export functions with the same signatures for backward compatibility
export const validateGoogleToken = async () => {
  // The browser service handles token validation internally
  // Return a dummy token string for compatibility
  return 'validated';
};

export const getTextFileContent = (fileId: string) => 
  googleDriveBrowser.getTextFileContent(fileId);

export const getDocxContent = (fileId: string) => 
  googleDriveBrowser.getDocsContent(fileId);

export const getPdfContent = async (fileId: string) => {
  console.warn('PDF content extraction not yet implemented');
  return '';
};

export const getFileContent = (fileId: string, mimeType: string) => 
  googleDriveBrowser.getFileContent(fileId, mimeType);

export const cleanContent = (content: string) => 
  googleDriveBrowser.cleanContent(content);