#!/usr/bin/env ts-node

import { SupabaseClientService } from '../packages/shared/services/supabase-client';
import { execSync } from 'child_process';

async function completeMigration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔄 Completing sys_cli_pipelines migration...\n');
  
  try {
    // Step 1: Update refactoring status
    console.log('📊 Step 1: Updating refactoring status...');
    execSync('ts-node scripts/cli-pipeline/registry/update-refactoring-status.ts', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Refactoring status updated\n');
    
    // Step 2: Archive the old table
    console.log('📦 Step 2: Archiving registry_cli_pipelines...');
    execSync('./scripts/cli-pipeline/archive/archive-cli.sh archive-table registry_cli_pipelines --reason "Migrated to sys_cli_pipelines for consistent sys_ naming convention" --by "migration-script"', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Table archived\n');
    
    // Step 3: Drop the old table
    console.log('🗑️  Step 3: Dropping registry_cli_pipelines...');
    console.log('⚠️  For safety, please run this SQL manually after confirming the archive:');
    console.log('   DROP TABLE registry_cli_pipelines CASCADE;');
    console.log('');
    
    // Step 4: Verify the migration
    console.log('🔍 Step 4: Verifying migration...\n');
    
    // Check sys_cli_pipelines
    const { count: sysCount, error: sysError } = await supabase
      .from('sys_cli_pipelines')
      .select('*', { count: 'exact', head: true });
    
    if (sysError) {
      console.error('❌ Error checking sys_cli_pipelines:', sysError);
    } else {
      console.log(`✅ sys_cli_pipelines has ${sysCount} records`);
    }
    
    // Check refactoring data
    const { data: refactoringStats, error: refError } = await supabase
      .from('sys_cli_pipelines')
      .select('refactoring_group')
      .not('refactoring_group', 'is', null);
    
    if (refError) {
      console.error('❌ Error checking refactoring data:', refError);
    } else {
      const groups = refactoringStats.reduce((acc: any, row: any) => {
        acc[row.refactoring_group] = (acc[row.refactoring_group] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 Refactoring groups:');
      Object.entries(groups).forEach(([group, count]) => {
        console.log(`   ${group}: ${count} pipelines`);
      });
    }
    
    // Check archived table
    const { data: archive, error: archiveError } = await supabase
      .from('sys_archived_tables')
      .select('table_name, row_count, archived_at')
      .eq('table_name', 'registry_cli_pipelines')
      .single();
    
    if (archiveError) {
      console.log('⚠️  registry_cli_pipelines not archived yet');
    } else {
      console.log(`✅ registry_cli_pipelines archived with ${archive.row_count} rows at ${archive.archived_at}`);
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

completeMigration();