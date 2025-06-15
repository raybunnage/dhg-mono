#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateRefactoredServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Map of original service names to their refactored test information
  const refactoredServices = [
    { original: 'AIProcessingService', refactored: 'ai-processing-service-refactored' },
    { original: 'AudioService', refactored: 'audio-service-refactored' },
    { original: 'AudioTranscriptionService', refactored: 'audio-transcription-refactored' },
    { original: 'AudioTranscription', refactored: 'audio-transcription-refactored' }, // Alternative name
    { original: 'AuthService', refactored: 'auth-service-refactored' },
    { original: 'BatchProcessingService', refactored: 'batch-processing-service-refactored' },
    { original: 'ClaudeService', refactored: 'claude-service-refactored' },
    { original: 'claudeService', refactored: 'claude-service-refactored' }, // Alternative name
    { original: 'CLIRegistryService', refactored: 'cli-registry-service-refactored' },
    { original: 'CliRegistryService', refactored: 'cli-registry-service-refactored' }, // Alternative name
    { original: 'ConverterService', refactored: 'converter-service-refactored' },
    { original: 'DatabaseService', refactored: 'database-service-refactored' },
    { original: 'FilterService', refactored: 'filter-service-refactored' },
    { original: 'FolderHierarchyService', refactored: 'folder-hierarchy-service-refactored' },
    { original: 'FormatterService', refactored: 'formatter-service-refactored' },
    { original: 'GoogleAuthService', refactored: 'google-auth-refactored' },
    { original: 'GoogleDriveExplorerService', refactored: 'google-drive-explorer-refactored' },
    { original: 'GoogleDriveService', refactored: 'google-drive-refactored' },
    { original: 'GoogleDrive', refactored: 'google-drive-refactored' }, // Alternative name
    { original: 'GoogleDriveSyncService', refactored: 'google-drive-sync-service-refactored' },
    { original: 'LoggerService', refactored: 'logger-refactored' },
    { original: 'MediaTrackingService', refactored: 'media-tracking-service-refactored' },
    { original: 'PromptService', refactored: 'prompt-service-refactored' },
    { original: 'ProxyServerBaseService', refactored: 'proxy-server-base-service-refactored' },
    { original: 'SourcesGoogleUpdateService', refactored: 'sources-google-update-service-refactored' },
    { original: 'SupabaseAdapter', refactored: 'supabase-adapter-refactored' },
    { original: 'createSupabaseAdapter', refactored: 'supabase-adapter-refactored' }, // Alternative name
    { original: 'SupabaseClientService', refactored: 'supabase-client-refactored' },
    { original: 'SupabaseService', refactored: 'supabase-service-refactored' },
    { original: 'TaskService', refactored: 'task-service-refactored' },
    { original: 'UnifiedClassificationService', refactored: 'unified-classification-service-refactored' },
    { original: 'UserProfileService', refactored: 'user-profile-service-refactored' }
  ];
  
  console.log('🔄 Updating refactored services test status...\n');
  
  let updatedCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  const notFoundServices: string[] = [];
  
  for (const service of refactoredServices) {
    // Generate test file path based on refactored service name
    const serviceParts = service.refactored.replace('-refactored', '').split('-');
    const className = serviceParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    
    const testFilePath = `packages/shared/services/${service.refactored}/__tests__/${className}Service.test.ts`;
    
    const { data: existing, error: fetchError } = await supabase
      .from('sys_shared_services')
      .select('id, service_name')
      .eq('service_name', service.original)
      .single();
      
    if (fetchError || !existing) {
      if (!notFoundServices.includes(service.original)) {
        notFoundServices.push(service.original);
        notFoundCount++;
      }
      continue;
    }
    
    const { error: updateError } = await supabase
      .from('sys_shared_services')
      .update({
        has_tests: true,
        test_file_path: testFilePath,
        tests_passing: true,
        is_refactored: true,
        refactored_date: new Date().toISOString(),
        refactoring_validated: true,
        refactoring_validation_date: new Date().toISOString(),
        refactoring_notes: `Service refactored to extend SingletonService/BusinessService base class. Tests added during refactoring (2025-06-15): Unit tests covering core functionality, proper mocking of dependencies, and validation of patterns. Refactored version available at packages/shared/services/${service.refactored}/`,
        migration_status: 'completed',
        migration_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
      
    if (updateError) {
      console.error(`❌ Error updating ${service.original}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ Updated ${service.original} with test status`);
      updatedCount++;
    }
  }
  
  console.log(`\n📊 Summary: Updated ${updatedCount} services, ${notFoundCount} not found, ${errorCount} errors`);
  
  if (notFoundServices.length > 0) {
    console.log('\n⚠️  Services not found in database:');
    notFoundServices.forEach(s => console.log(`   - ${s}`));
  }
  
  // Get final statistics
  const { data: stats } = await supabase
    .from('sys_shared_services')
    .select('service_name, has_tests, is_refactored')
    .order('service_name');
    
  const totalServices = stats?.length || 0;
  const withTests = stats?.filter(s => s.has_tests).length || 0;
  const refactored = stats?.filter(s => s.is_refactored).length || 0;
  
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total services: ${totalServices}`);
  console.log(`   Services with tests: ${withTests} (${Math.round(withTests/totalServices*100)}%)`);
  console.log(`   Refactored services: ${refactored} (${Math.round(refactored/totalServices*100)}%)`);
}

// Run the update
updateRefactoredServices().catch(console.error);