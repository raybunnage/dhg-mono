#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ArchivedScript {
  id: string;
  archive_id: string;
  archive_date: string;
  original_path: string;
  archived_path: string;
  file_name: string;
  script_type: string;
  pipeline_name?: string;
  command_name?: string;
  archive_reason?: string;
  replacement_command?: string;
  restored: boolean;
}

class ScriptRestorer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');

  async restore(options: {
    path?: string;
    archiveId?: string;
    interactive?: boolean;
  }) {
    const { path: originalPath, archiveId, interactive = true } = options;
    
    console.log('♻️  Script Restoration Tool\n');
    
    if (!originalPath && !archiveId) {
      console.error('Error: Must specify either --path or --archive-id');
      process.exit(1);
    }
    
    let scriptsToRestore: ArchivedScript[] = [];
    
    if (originalPath) {
      // Restore specific script by path
      const { data, error } = await this.supabase
        .from('sys_archived_scripts_files')
        .select('*')
        .eq('original_path', originalPath)
        .eq('restored', false)
        .order('archive_date', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Database error:', error);
        process.exit(1);
      }
      
      if (!data || data.length === 0) {
        console.error(`No archived script found with path: ${originalPath}`);
        console.log('\nTip: Use list-archived command to see available scripts');
        process.exit(1);
      }
      
      scriptsToRestore = data;
    } else if (archiveId) {
      // Restore all scripts from an archive batch
      const { data, error } = await this.supabase
        .from('sys_archived_scripts_files')
        .select('*')
        .eq('archive_id', archiveId)
        .eq('restored', false);
      
      if (error) {
        console.error('Database error:', error);
        process.exit(1);
      }
      
      if (!data || data.length === 0) {
        console.error(`No scripts found for archive ID: ${archiveId}`);
        process.exit(1);
      }
      
      scriptsToRestore = data;
    }
    
    console.log(`Found ${scriptsToRestore.length} script(s) to restore\n`);
    
    // Show scripts to be restored
    this.displayScripts(scriptsToRestore);
    
    // Confirm restoration
    if (interactive) {
      const confirmed = await this.confirmRestore(scriptsToRestore);
      if (!confirmed) {
        console.log('Restoration cancelled.');
        return;
      }
    }
    
    // Restore each script
    let successCount = 0;
    let failureCount = 0;
    
    for (const script of scriptsToRestore) {
      const success = await this.restoreScript(script);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Commit changes to git
    if (successCount > 0) {
      await this.commitToGit(scriptsToRestore, successCount);
    }
    
    // Summary
    console.log('\n=== RESTORATION SUMMARY ===\n');
    console.log(`✅ Successfully restored: ${successCount}`);
    if (failureCount > 0) {
      console.log(`❌ Failed to restore: ${failureCount}`);
    }
    console.log('\nScripts have been restored to their original locations.');
  }

  private displayScripts(scripts: ArchivedScript[]) {
    console.log('Scripts to restore:');
    console.log('─'.repeat(80));
    
    for (const script of scripts) {
      console.log(`\n📄 ${script.original_path}`);
      console.log(`   Archive ID: ${script.archive_id}`);
      console.log(`   Archived: ${new Date(script.archive_date).toLocaleDateString()}`);
      console.log(`   Type: ${script.script_type}`);
      if (script.pipeline_name) {
        console.log(`   Pipeline: ${script.pipeline_name}`);
      }
      if (script.archive_reason) {
        console.log(`   Reason: ${script.archive_reason}`);
      }
      if (script.replacement_command) {
        console.log(`   Replacement: ${script.replacement_command}`);
      }
    }
    console.log('');
  }

  private async confirmRestore(scripts: ArchivedScript[]): Promise<boolean> {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question(
        `\n⚠️  Restore ${scripts.length} script(s) to original location(s)? (yes/no): `,
        (answer) => {
          readline.close();
          resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        }
      );
    });
  }

  private async restoreScript(script: ArchivedScript): Promise<boolean> {
    const archivedPath = path.join(this.projectRoot, script.archived_path);
    const originalPath = path.join(this.projectRoot, script.original_path);
    
    console.log(`\nRestoring: ${script.original_path}`);
    
    // Check if archived file exists
    if (!fs.existsSync(archivedPath)) {
      console.error(`  ❌ Archived file not found: ${script.archived_path}`);
      return false;
    }
    
    // Check if original path is available
    if (fs.existsSync(originalPath)) {
      console.error(`  ❌ File already exists at original location: ${script.original_path}`);
      console.log(`     Please remove or rename the existing file first.`);
      return false;
    }
    
    try {
      // Create directory if needed
      const originalDir = path.dirname(originalPath);
      fs.mkdirSync(originalDir, { recursive: true });
      
      // Move file back
      fs.renameSync(archivedPath, originalPath);
      console.log(`  ✅ Restored to: ${script.original_path}`);
      
      // Update database
      const { error } = await this.supabase
        .from('sys_archived_scripts_files')
        .update({
          restored: true,
          restored_date: new Date().toISOString(),
          restored_by: 'deprecation-cli',
          updated_at: new Date().toISOString()
        })
        .eq('id', script.id);
      
      if (error) {
        console.error('  ⚠️  Warning: Failed to update database:', error);
      }
      
      // Re-register CLI command if applicable
      if (script.script_type === 'cli_pipeline' && script.pipeline_name) {
        console.log(`  ℹ️  Remember to re-register CLI command if needed:`);
        console.log(`     ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry`);
      }
      
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to restore:`, error);
      return false;
    }
  }

  private async commitToGit(scripts: ArchivedScript[], count: number) {
    console.log('\n📝 Committing to git...');
    
    try {
      // Stage restored files
      execSync('git add -A', { cwd: this.projectRoot });
      
      // Create commit message
      const scriptList = scripts
        .slice(0, 5)
        .map(s => `  - ${s.original_path}`)
        .join('\n');
      
      const message = `chore: restore ${count} archived script${count > 1 ? 's' : ''}

Restored scripts:
${scriptList}${scripts.length > 5 ? `\n  ... and ${scripts.length - 5} more` : ''}

Scripts restored using deprecation-cli.sh restore-script`;
      
      execSync(`git commit -m "${message}"`, { cwd: this.projectRoot });
      console.log('✅ Changes committed to git');
    } catch (error) {
      console.error('Git commit failed:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    path: args.find((a, i) => args[i - 1] === '--path')?.toString(),
    archiveId: args.find((a, i) => args[i - 1] === '--archive-id')?.toString(),
    interactive: !args.includes('--no-confirm')
  };
  
  if (args.includes('--help')) {
    console.log('Usage: restore-script [options]');
    console.log('\nOptions:');
    console.log('  --path <path>       Restore script by original path');
    console.log('  --archive-id <id>   Restore all scripts from archive batch');
    console.log('  --no-confirm        Skip confirmation prompt');
    console.log('  --help              Show this help');
    console.log('\nExamples:');
    console.log('  restore-script --path scripts/old-script.sh');
    console.log('  restore-script --archive-id 20250608-1234567890');
    process.exit(0);
  }
  
  const restorer = new ScriptRestorer();
  restorer.restore(options).catch(console.error);
}