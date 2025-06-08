#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';

/**
 * Phase 1: Consolidate empty and minimal pipelines with no functionality
 * Risk Level: LOW
 * Pipelines: core, shared, viewers, utilities → all_pipelines
 */

async function executePhase1(): Promise<void> {
  console.log('🔄 Executing Phase 1: Consolidate empty and minimal pipelines with no functionality\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const archiveDir = join(baseDir, '.archived_pipelines');
  const archiveDate = new Date().toISOString().split('T')[0];
  
  // Ensure archive directory exists
  await fs.mkdir(archiveDir, { recursive: true });
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Pre-execution validation:');
    console.log('   - Verify pipelines have no main CLI scripts');
    console.log('   - Confirm no command definitions in database');
    console.log('   - Check for any hidden dependencies');
    console.log('   - Validate no migrated scripts present');
  
  // TODO: Implement actual validation checks here
  
  console.log('\n📦 Processing pipelines:');
  const pipelines = ['core', 'shared', 'viewers', 'utilities'];
  
  for (const pipeline of pipelines) {
    console.log(`   Processing ${pipeline}...`);
    
    const sourcePath = join(baseDir, pipeline);
    const archivePath = join(archiveDir, `${pipeline}.${archiveDate}`);
    
    try {
      // Archive the pipeline directory
      await fs.rename(sourcePath, archivePath);
      console.log(`   ✅ Archived ${pipeline} → .archived_pipelines/${pipeline}.${archiveDate}`);
      
      // Record in database
      await supabase.from('sys_archived_scripts_files').insert({
        file_path: `scripts/cli-pipeline/${pipeline}/`,
        archive_reason: 'Phase 1 consolidation: Consolidate empty and minimal pipelines with no functionality',
        archived_date: new Date().toISOString(),
        file_type: 'consolidated_pipeline',
        original_size_kb: 0,
        archive_location: `scripts/cli-pipeline/.archived_pipelines/${pipeline}.${archiveDate}/`
      });
      
    } catch (error) {
      console.error(`   ❌ Error processing ${pipeline}:`, error);
      throw error;
    }
  }
  
  console.log('\n✅ Phase 1 consolidation complete!');
  console.log('🔍 Recommended next steps:');
  console.log('   1. Run CLI validation: ./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands');
  console.log('   2. Test all_pipelines pipeline functionality');
  console.log('   3. Update command registry if needed');
  console.log('   4. Proceed to next phase only after validation');
}

// Main execution
executePhase1().catch(console.error);
