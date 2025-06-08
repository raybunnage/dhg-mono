#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const EMPTY_PIPELINES = ['documentation', 'examples', 'merge', 'worktree'];

async function archiveEmptyPipelines(): Promise<void> {
  console.log('🗂️  Archiving Empty Pipelines\n');
  
  const pipelineDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const archiveDir = join(pipelineDir, '.archived_pipelines');
  
  // Ensure archive directory exists
  try {
    await fs.mkdir(archiveDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const archiveDate = new Date().toISOString().split('T')[0];
  
  for (const pipeline of EMPTY_PIPELINES) {
    const sourcePath = join(pipelineDir, pipeline);
    const archivePath = join(archiveDir, `${pipeline}.${archiveDate}`);
    
    try {
      // Check if directory exists and is actually empty
      const files = await fs.readdir(sourcePath);
      console.log(`📁 ${pipeline}: Found ${files.length} files`);
      
      if (files.length <= 2) { // Only . and .. entries, or truly empty
        // Archive the directory
        await fs.rename(sourcePath, archivePath);
        console.log(`✅ Archived ${pipeline} → .archived_pipelines/${pipeline}.${archiveDate}`);
        
        // Record in database
        await supabase.from('sys_archived_scripts_files').insert({
          file_path: `scripts/cli-pipeline/${pipeline}/`,
          archive_reason: 'Empty pipeline directory with no functionality',
          archived_date: new Date().toISOString(),
          file_type: 'pipeline_directory',
          original_size_kb: 0,
          archive_location: `scripts/cli-pipeline/.archived_pipelines/${pipeline}.${archiveDate}/`
        });
        
        console.log(`💾 Recorded archival in sys_archived_scripts_files`);
      } else {
        console.log(`⚠️  Skipped ${pipeline}: Contains ${files.length} files (not empty)`);
      }
      
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`⚠️  ${pipeline}: Directory does not exist (already removed?)`);
      } else {
        console.error(`❌ Error archiving ${pipeline}:`, error as Error);
      }
    }
  }
  
  console.log('\n📊 Archive Summary:');
  console.log('- Empty pipelines identified: 4');
  console.log('- Archive location: scripts/cli-pipeline/.archived_pipelines/');
  console.log('- Database records: sys_archived_scripts_files');
}

// Main execution
archiveEmptyPipelines().catch(console.error);