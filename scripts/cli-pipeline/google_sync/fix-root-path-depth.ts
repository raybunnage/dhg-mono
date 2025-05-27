#!/usr/bin/env node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Command } from 'commander';

const program = new Command();

program
  .name('fix-root-path-depth')
  .description('Fix path_depth for root folders to be -1')
  .option('--dry-run', 'Show what would be updated without making changes')
  .action(async (options) => {
    const supabase = SupabaseClientService.getInstance().getClient();
    const isDryRun = options.dryRun;
    
    console.log(`🔧 Fix Root Folder Path Depth ${isDryRun ? '(DRY RUN)' : ''}`);
    console.log('='.repeat(50));
    
    try {
      // First, get all unique root_drive_ids
      const { data: uniqueRoots, error: rootsError } = await supabase
        .from('sources_google')
        .select('root_drive_id')
        .not('root_drive_id', 'is', null);
        
      if (rootsError) throw rootsError;
      
      const rootDriveIds = [...new Set(uniqueRoots?.map(r => r.root_drive_id) || [])];
      
      console.log(`\n📊 Found ${rootDriveIds.length} unique root_drive_ids`);
      
      // Check folders where drive_id matches root_drive_id (these are root folders)
      const { data: rootFolders, error: foldersError } = await supabase
        .from('sources_google')
        .select('id, drive_id, name, path_depth, is_root, root_drive_id')
        .in('drive_id', rootDriveIds)
        .eq('mime_type', 'application/vnd.google-apps.folder');
        
      if (foldersError) throw foldersError;
      
      console.log(`\n🌲 Found ${rootFolders?.length || 0} root folders`);
      
      const foldersToFix = rootFolders?.filter(f => f.path_depth !== -1) || [];
      
      if (foldersToFix.length === 0) {
        console.log('\n✅ All root folders already have path_depth = -1');
        return;
      }
      
      console.log(`\n⚠️  ${foldersToFix.length} root folders need path_depth fix:`);
      
      for (const folder of foldersToFix) {
        console.log(`\n📁 ${folder.name}`);
        console.log(`   - drive_id: ${folder.drive_id}`);
        console.log(`   - current path_depth: ${folder.path_depth} ❌`);
        console.log(`   - is_root: ${folder.is_root}`);
        
        if (!isDryRun) {
          // Update the folder's path_depth to -1
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ 
              path_depth: -1,
              is_root: true  // Also ensure is_root is set
            })
            .eq('id', folder.id);
            
          if (updateError) {
            console.error(`   ❌ Error updating: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated path_depth to -1`);
          }
        } else {
          console.log(`   🔍 Would update path_depth to -1`);
        }
      }
      
      if (isDryRun) {
        console.log('\n💡 Run without --dry-run to apply these changes');
      } else {
        console.log(`\n✅ Successfully updated ${foldersToFix.length} root folders`);
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();