import { SupabaseClientService } from './packages/shared/services/supabase-client';
import { readFileSync } from 'fs';

async function applyMigration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Read the migration file
  const sql = readFileSync('./supabase/migrations/20250614_add_refactoring_tracking_to_sys_shared_services.sql', 'utf-8');
  
  console.log('Applying migration to add refactoring tracking columns...');
  
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  
  if (error) {
    console.error('Migration failed:', error);
    return;
  }
  
  console.log('Migration applied successfully!');
  
  // Now let's update the table with all the refactored services we found
  console.log('\nUpdating refactored services in database...');
  
  const refactoredPaths = [
    'ai-processing-service-refactored/',
    'audio-proxy-refactored/',
    'audio-service-refactored/',
    'audio-transcription-refactored/',
    'auth-service-refactored/',
    'batch-processing-service-refactored/',
    'claude-service-refactored/',
    'cli-registry-service-refactored/',
    'converter-service-refactored/',
    'database-service-refactored/',
    'element-catalog-service-refactored/',
    'element-criteria-service-refactored/',
    'file-service-refactored/',
    'filter-service-refactored/',
    'folder-hierarchy-service-refactored/',
    'formatter-service-refactored/',
    'google-auth-refactored/',
    'google-drive-explorer-refactored/',
    'google-drive-refactored/',
    'logger-refactored/',
    'media-analytics-service-refactored/',
    'media-tracking-service-refactored/',
    'prompt-service-refactored/',
    'proxy-server-base-service-refactored/',
    'supabase-adapter-refactored/',
    'supabase-client-refactored/',
    'supabase-service-refactored/',
    'task-service-refactored/',
    'unified-classification-service-refactored/',
    'user-profile-service-refactored/'
  ];
  
  // Update validated services
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
  
  const { error: updateError } = await supabase
    .from('sys_shared_services')
    .update({
      refactoring_validated: true,
      refactoring_validation_date: new Date().toISOString(),
      tests_passing: true
    })
    .in('service_name', validatedServices);
    
  if (updateError) {
    console.error('Error updating validated services:', updateError);
  } else {
    console.log(`Updated ${validatedServices.length} validated services`);
  }
}

applyMigration();