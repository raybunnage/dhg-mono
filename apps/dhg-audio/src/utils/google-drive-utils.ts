// MIGRATED: This file now uses the enhanced shared GoogleDriveService
// Original implementation backed up as google-drive-utils.ts.backup
// The shared service includes all the original functionality plus more

export {
  extractDriveId,
  getAudioProxyBaseUrl,
  getAudioProxyUrl,
  getGoogleDrivePreviewUrl,
  getGoogleDriveDownloadUrl,
  getAudioUrlOptions,
  getAudioUrlOptionsObject
} from './google-drive-utils-enhanced';

// Legacy export aliases for backward compatibility
export { getAudioUrlOptionsForDhgAudio as getAudioUrlOptions } from './google-drive-utils-enhanced';

// Export types
export type { AudioUrlOptions, AudioProxyConfig } from './google-drive-utils-enhanced';
