import { functionRegistry } from '../function-registry';

functionRegistry.register('syncGoogleDriveFiles', {
  description: 'Main sync function to update local database with Google Drive files',
  status: 'active',
  location: 'src/utils/google-drive-sync.ts',
  category: 'GOOGLE_DRIVE',
  dependencies: ['google-auth-library', 'supabase'],
  usedIn: ['SourceButtons'],
  targetPackage: 'google-drive-sync'
}); 