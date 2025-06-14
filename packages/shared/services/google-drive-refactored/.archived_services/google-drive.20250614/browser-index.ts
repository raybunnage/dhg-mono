/**
 * Browser-safe exports for Google Drive services
 * 
 * This file only exports services that are safe to use in browser environments.
 * It excludes Node.js-specific services like GoogleAuthService and GoogleDriveService.
 */

export { GoogleDriveBrowserService, googleDriveBrowser } from './google-drive-browser-service';

// Re-export browser-safe types
export type { GoogleDriveFile, GoogleDriveFileType } from './google-drive-browser-service';