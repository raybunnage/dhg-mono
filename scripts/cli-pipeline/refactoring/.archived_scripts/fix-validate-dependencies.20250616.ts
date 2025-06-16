import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const servicesToFix = [
  'ai-processing-service-refactored/AIProcessingService.ts',
  'audio-proxy-refactored/AudioProxyService.ts',
  'audio-service-refactored/AudioService.ts',
  'audio-transcription-refactored/AudioTranscriptionService.ts',
  'batch-processing-service-refactored/BatchProcessingService.ts',
  'cli-registry-service-refactored/CLIRegistryService.ts',
  'database-service-refactored/DatabaseService.ts',
  'logger-refactored/LoggerService.ts',
  'media-tracking-service-refactored/MediaTrackingService.ts',
  'proxy-server-base-service-refactored/ProxyServerBaseService.ts',
  'supabase-adapter-refactored/SupabaseAdapterService.ts',
  'supabase-client-refactored/SupabaseClientService.ts',
  'supabase-service-refactored/SupabaseService.ts'
];

const basePath = './packages/shared/services';

servicesToFix.forEach(servicePath => {
  const fullPath = resolve(basePath, servicePath);
  
  if (!existsSync(fullPath)) {
    console.log(`❌ File not found: ${servicePath}`);
    return;
  }
  
  const content = readFileSync(fullPath, 'utf-8');
  
  // Check if it already has validateDependencies
  if (content.includes('validateDependencies')) {
    console.log(`✓ Already has validateDependencies: ${servicePath}`);
    return;
  }
  
  // Check if it extends BusinessService
  if (!content.includes('extends BusinessService')) {
    console.log(`⚠️  Does not extend BusinessService: ${servicePath}`);
    return;
  }
  
  // Find constructor and add validateDependencies after it
  const constructorMatch = content.match(/constructor\([^)]*\)\s*{[^}]*}/s);
  if (!constructorMatch) {
    console.log(`❌ Could not find constructor: ${servicePath}`);
    return;
  }
  
  const constructorEnd = constructorMatch.index! + constructorMatch[0].length;
  
  // Add validateDependencies method
  const validateMethod = `

  /**
   * Validate that all required dependencies are provided
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabase) {
      throw new Error('SupabaseClient is required');
    }
  }`;
  
  const newContent = 
    content.slice(0, constructorEnd) + 
    validateMethod + 
    content.slice(constructorEnd);
  
  writeFileSync(fullPath, newContent);
  console.log(`✅ Added validateDependencies to: ${servicePath}`);
});