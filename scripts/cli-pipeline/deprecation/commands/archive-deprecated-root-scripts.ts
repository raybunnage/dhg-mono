#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

// Scripts identified as deprecated from analysis
const DEPRECATED_SCRIPTS = [
  'scripts/app-management/backup-archives.sh',
  'scripts/root/backup-env.sh', 
  'scripts/root/test-gitignore.sh'
];

async function archiveDeprecatedRootScripts(): Promise<void> {
  console.log('🗂️  Archiving Deprecated Root Scripts\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code';
  const archiveDir = join(baseDir, 'scripts', '.archived_root_scripts');
  const archiveDate = new Date().toISOString().split('T')[0];
  
  // Ensure archive directory exists
  try {
    await fs.mkdir(archiveDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
  
  const supabase = SupabaseClientService.getInstance().getClient();
  let archivedCount = 0;
  
  for (const scriptPath of DEPRECATED_SCRIPTS) {
    const fullPath = join(baseDir, scriptPath);
    const filename = basename(scriptPath);
    const archivePath = join(archiveDir, `${filename}.${archiveDate}`);
    
    try {
      // Check if script exists
      const stats = await fs.stat(fullPath);
      console.log(`📁 ${filename}: Found (${stats.size} bytes)`);
      
      // Read content to determine reason
      const content = await fs.readFile(fullPath, 'utf-8');
      let archiveReason = 'Deprecated root script';
      
      if (filename.includes('backup')) {
        archiveReason = 'Legacy backup script - superseded by new backup system';
      } else if (filename.includes('test')) {
        archiveReason = 'Old test script - no longer used';
      }
      
      // Archive the file
      await fs.rename(fullPath, archivePath);
      console.log(`✅ Archived ${filename} → .archived_root_scripts/${filename}.${archiveDate}`);
      
      // Record in database
      await supabase.from('sys_archived_scripts_files').insert({
        file_path: scriptPath,
        archive_reason: archiveReason,
        archived_date: new Date().toISOString(),
        file_type: 'root_script',
        original_size_kb: Math.round(stats.size / 1024),
        archive_location: `scripts/.archived_root_scripts/${filename}.${archiveDate}`
      });
      
      console.log(`💾 Recorded archival in sys_archived_scripts_files`);
      archivedCount++;
      
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`⚠️  ${filename}: File does not exist (already archived?)`);
      } else {
        console.error(`❌ Error archiving ${filename}:`, error as Error);
      }
    }
  }
  
  console.log('\n📊 Archive Summary:');
  console.log(`- Scripts processed: ${DEPRECATED_SCRIPTS.length}`);
  console.log(`- Successfully archived: ${archivedCount}`);
  console.log('- Archive location: scripts/.archived_root_scripts/');
  console.log('- Database records: sys_archived_scripts_files');
  
  if (archivedCount > 0) {
    console.log('\n✨ Root script archival complete!');
    console.log('📈 Impact: Reduced root script clutter by removing deprecated files');
  }
}

// Main execution
archiveDeprecatedRootScripts().catch(console.error);