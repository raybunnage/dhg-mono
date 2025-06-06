/**
 * Export all Google Drive services
 * 
 * This index file provides an easy way to import all Google Drive services
 * and also exports a preconfigured auth instance that can be used directly
 */

import GoogleAuthService from './google-auth-service';
import GoogleDriveService from './google-drive-service';
import GoogleDriveSyncService from './google-drive-sync-service';
import SourcesGoogleUpdateService from './sources-google-update-service';
import { GoogleDriveBrowserService, googleDriveBrowser } from './google-drive-browser-service';

// Export services
export { 
  GoogleAuthService, 
  GoogleDriveService, 
  GoogleDriveSyncService, 
  SourcesGoogleUpdateService,
  GoogleDriveBrowserService,
  googleDriveBrowser
};

// Export types
export * from './google-auth-service';
export * from './google-drive-service';
export * from './google-drive-sync-service';
export * from './sources-google-update-service';
export * from './google-drive-browser-service';

// Export a preconfigured auth instance for easier use
export const defaultGoogleAuth = GoogleAuthService.getDefaultInstance();

/**
 * Helper function to get a Google Drive service instance with default auth
 */
export function getGoogleDriveService(supabaseClient: any): GoogleDriveService {
  return GoogleDriveService.getInstance(defaultGoogleAuth, supabaseClient);
}

/**
 * Helper function to get a Google Drive Sync service instance with default auth
 */
export function getGoogleDriveSyncService(supabaseClient: any): GoogleDriveSyncService {
  const driveService = getGoogleDriveService(supabaseClient);
  return GoogleDriveSyncService.getInstance(driveService, supabaseClient);
}

/**
 * Helper function to get a Sources Google Update service instance with default auth
 */
export function getSourcesGoogleUpdateService(supabaseClient: any): SourcesGoogleUpdateService {
  const driveService = getGoogleDriveService(supabaseClient);
  return SourcesGoogleUpdateService.getInstance(driveService, supabaseClient);
}