import { functionRegistry } from '../function-registry';

functionRegistry.register('syncFileMetadata', {
  description: 'Main metadata sync orchestrator',
  status: 'active',
  location: 'src/utils/metadata-sync.ts',
  category: 'METADATA',
  dependencies: ['supabase', 'google-auth-library'],
  usedIn: ['SourceButtons'],
  targetPackage: 'metadata-sync'
}); 