import { existsSync } from 'fs';
import { resolve } from 'path';

interface ServiceTestStatus {
  name: string;
  path: string;
  hasTestFile: boolean;
  testPath?: string;
  validated: boolean;
}

const refactoredServices = [
  { name: 'AIProcessingService', path: 'ai-processing-service-refactored' },
  { name: 'AudioProxyService', path: 'audio-proxy-refactored' },
  { name: 'AudioService', path: 'audio-service-refactored' },
  { name: 'AudioTranscriptionService', path: 'audio-transcription-refactored' },
  { name: 'AuthService', path: 'auth-service-refactored' },
  { name: 'BatchProcessingService', path: 'batch-processing-service-refactored' },
  { name: 'ClaudeService', path: 'claude-service-refactored' },
  { name: 'CLIRegistryService', path: 'cli-registry-service-refactored' },
  { name: 'ConverterService', path: 'converter-service-refactored' },
  { name: 'DatabaseService', path: 'database-service-refactored' },
  { name: 'ElementCatalogService', path: 'element-catalog-service-refactored' },
  { name: 'ElementCriteriaService', path: 'element-criteria-service-refactored' },
  { name: 'FileService', path: 'file-service-refactored' },
  { name: 'FilterService', path: 'filter-service-refactored' },
  { name: 'FolderHierarchyService', path: 'folder-hierarchy-service-refactored' },
  { name: 'FormatterService', path: 'formatter-service-refactored' },
  { name: 'GoogleAuthService', path: 'google-auth-refactored' },
  { name: 'GoogleDriveExplorerService', path: 'google-drive-explorer-refactored' },
  { name: 'GoogleDriveService', path: 'google-drive-refactored' },
  { name: 'LoggerService', path: 'logger-refactored' },
  { name: 'MediaAnalyticsService', path: 'media-analytics-service-refactored' },
  { name: 'MediaTrackingService', path: 'media-tracking-service-refactored' },
  { name: 'PromptService', path: 'prompt-service-refactored' },
  { name: 'ProxyServerBaseService', path: 'proxy-server-base-service-refactored' },
  { name: 'SupabaseAdapterService', path: 'supabase-adapter-refactored' },
  { name: 'SupabaseClientService', path: 'supabase-client-refactored' },
  { name: 'SupabaseService', path: 'supabase-service-refactored' },
  { name: 'TaskService', path: 'task-service-refactored' },
  { name: 'UnifiedClassificationService', path: 'unified-classification-service-refactored' },
  { name: 'UserProfileService', path: 'user-profile-service-refactored' },
];

const validatedServices = [
  'AuthService',
  'FilterService',
  'TaskService',
  'GoogleDriveService',
  'GoogleAuthService',
  'UnifiedClassificationService',
  'UserProfileService',
  'PromptService'
];

function checkServiceTests(): ServiceTestStatus[] {
  const basePath = './packages/shared/services';
  const results: ServiceTestStatus[] = [];
  
  refactoredServices.forEach(service => {
    const servicePath = resolve(basePath, service.path);
    
    // Check for test files in common locations
    const possibleTestPaths = [
      `${service.name}.test.ts`,
      `${service.name.replace('Service', '')}.test.ts`,
      `__tests__/${service.name}.test.ts`,
      `tests/${service.name}.test.ts`,
      'test.ts'
    ];
    
    let testPath: string | undefined;
    let hasTestFile = false;
    
    for (const testFile of possibleTestPaths) {
      const fullTestPath = resolve(servicePath, testFile);
      if (existsSync(fullTestPath)) {
        hasTestFile = true;
        testPath = fullTestPath;
        break;
      }
    }
    
    results.push({
      name: service.name,
      path: service.path,
      hasTestFile,
      testPath,
      validated: validatedServices.includes(service.name)
    });
  });
  
  return results;
}

// Check all services
const results = checkServiceTests();

console.log('📊 Refactored Services Test Coverage Report');
console.log('==========================================\n');

console.log('✅ Validated Services (tests passing):');
results.filter(r => r.validated).forEach(r => {
  console.log(`  - ${r.name}`);
});

console.log('\n🧪 Services with test files (not yet validated):');
results.filter(r => r.hasTestFile && !r.validated).forEach(r => {
  console.log(`  - ${r.name} (${r.path})`);
});

console.log('\n❌ Services WITHOUT test files:');
results.filter(r => !r.hasTestFile).forEach(r => {
  console.log(`  - ${r.name} (${r.path})`);
});

console.log('\n📈 Statistics:');
console.log(`  Total refactored services: ${results.length}`);
console.log(`  Validated (tests passing): ${results.filter(r => r.validated).length}`);
console.log(`  Have test files: ${results.filter(r => r.hasTestFile).length}`);
console.log(`  Missing test files: ${results.filter(r => !r.hasTestFile).length}`);
console.log(`  Coverage: ${Math.round((results.filter(r => r.hasTestFile).length / results.length) * 100)}%`);