#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function showArchivedFiles(): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const { data: archivedFiles, error } = await supabase
    .from('sys_archived_cli_pipeline_files')
    .select('*')
    .order('archived_date');
    
  if (error) {
    console.error('Error fetching archived files:', error);
    return;
  }
  
  console.log('=== Archived CLI Pipeline Files ===\n');
  
  if (!archivedFiles || archivedFiles.length === 0) {
    console.log('No archived files found.');
    return;
  }
  
  archivedFiles.forEach((file, index) => {
    console.log(`📁 Record ${index + 1}:`);
    console.log(`   Pipeline: ${file.pipeline_name}`);
    console.log(`   Command: ${file.command_name}`);
    console.log(`   Original Path: ${file.original_file_path}`);
    console.log(`   Archived Path: ${file.archived_file_path}`);
    console.log(`   Usage Count: ${file.usage_count}`);
    console.log(`   Last Used: ${file.last_used_date || 'Never'}`);
    console.log(`   Archived Date: ${new Date(file.archived_date).toLocaleString()}`);
    console.log(`   Description: ${file.description}`);
    console.log('');
  });
  
  console.log(`Total archived files: ${archivedFiles.length}`);
}

// Run if called directly
if (require.main === module) {
  showArchivedFiles().catch(console.error);
}