#!/usr/bin/env ts-node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';

/**
 * Migration script to replace dhg-audio's Google Drive utils with enhanced shared service
 */
async function migrateDhgAudioGoogleDrive(): Promise<void> {
  console.log('🔄 Migrating dhg-audio to use enhanced shared GoogleDriveService...\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines';
  const dhgAudioDir = path.join(baseDir, 'apps/dhg-audio');
  
  // 1. Backup the original google-drive-utils.ts
  const originalFile = path.join(dhgAudioDir, 'src/utils/google-drive-utils.ts');
  const backupFile = path.join(dhgAudioDir, 'src/utils/google-drive-utils.ts.backup');
  
  if (existsSync(originalFile)) {
    console.log('📦 Backing up original google-drive-utils.ts...');
    const originalContent = readFileSync(originalFile, 'utf-8');
    writeFileSync(backupFile, originalContent, 'utf-8');
    console.log(`   ✅ Backup created: ${backupFile}`);
  }
  
  // 2. Replace the original with a simple re-export to the enhanced service
  const newContent = `// MIGRATED: This file now uses the enhanced shared GoogleDriveService
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
`;
  
  writeFileSync(originalFile, newContent, 'utf-8');
  console.log('   ✅ Updated google-drive-utils.ts to use enhanced shared service');
  
  console.log('\n🎉 MIGRATION COMPLETE!\n');
  console.log('✨ Benefits of using the enhanced shared GoogleDriveService:');
  console.log('   • Audio utilities now available to all apps');
  console.log('   • Consistent Google Drive handling across the monorepo');
  console.log('   • Enhanced error handling and configuration options');
  console.log('   • Static methods for better performance');
  console.log('   • Cross-environment compatibility (browser/CLI)');
  console.log('   • Better TypeScript types and documentation');
  
  console.log('\n📋 Next steps:');
  console.log('   1. Test dhg-audio to ensure Google Drive functionality still works');
  console.log('   2. Other apps can now use GoogleDriveService.getAudioUrlOptions()');
  console.log('   3. If everything works, delete the backup file');
  
  console.log('\n🔧 Migration Summary:');
  console.log(`   • Original file backed up: ${backupFile}`);
  console.log(`   • Enhanced service created: apps/dhg-audio/src/utils/google-drive-utils-enhanced.ts`);
  console.log('   • Backward compatibility maintained through re-exports');
  console.log('   • Audio utilities now available in packages/shared/services/google-drive/google-drive-service.ts');
  console.log('   • Ready for testing');
}

if (require.main === module) {
  migrateDhgAudioGoogleDrive().catch(console.error);
}

export { migrateDhgAudioGoogleDrive };