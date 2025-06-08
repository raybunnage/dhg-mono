#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

interface RestoreOptions {
  archiveId?: string;
  category?: string;
  dateRange?: string;
  dryRun?: boolean;
  force?: boolean;
}

interface ScriptToRestore {
  id: string;
  original_path: string;
  archived_path: string;
  archive_id: string;
  archive_date: Date;
  archive_reason: string;
  script_type: string;
}

class BatchRestorer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private scriptsToRestore: ScriptToRestore[] = [];
  private restoredCount = 0;
  private skippedCount = 0;
  private errorCount = 0;

  async restore(options: RestoreOptions) {
    console.log('♻️  Batch Script Restoration Tool\n');
    
    // Step 1: Query scripts to restore based on criteria
    await this.findScriptsToRestore(options);
    
    if (this.scriptsToRestore.length === 0) {
      console.log('No scripts found matching the criteria.');
      return;
    }
    
    // Step 2: Show what will be restored
    this.showRestorePlan(options);
    
    // Step 3: Confirm if not forced
    if (!options.force && !options.dryRun) {
      const confirmed = await this.confirmRestore();
      if (!confirmed) {
        console.log('Restoration cancelled.');
        return;
      }
    }
    
    // Step 4: Perform restoration
    if (!options.dryRun) {
      await this.performRestoration();
    }
    
    // Step 5: Generate summary
    this.generateSummary(options);
  }

  private async findScriptsToRestore(options: RestoreOptions) {
    console.log('🔍 Finding scripts to restore...');
    
    let query = this.supabase
      .from('sys_archived_scripts_files')
      .select('*')
      .eq('restored', false);
    
    // Apply filters
    if (options.archiveId) {
      query = query.eq('archive_id', options.archiveId);
      console.log(`  Filter: Archive ID = ${options.archiveId}`);
    }
    
    if (options.category) {
      query = query.eq('script_type', options.category);
      console.log(`  Filter: Script Type = ${options.category}`);
    }
    
    if (options.dateRange) {
      const [startDate, endDate] = options.dateRange.split(',');
      if (startDate && endDate) {
        query = query.gte('archive_date', startDate).lte('archive_date', endDate);
        console.log(`  Filter: Date Range = ${startDate} to ${endDate}`);
      }
    }
    
    const { data, error } = await query.order('archive_date', { ascending: false });
    
    if (error) {
      console.error('Error querying archived scripts:', error);
      return;
    }
    
    this.scriptsToRestore = data || [];
    console.log(`\n  Found ${this.scriptsToRestore.length} scripts to restore\n`);
  }

  private showRestorePlan(options: RestoreOptions) {
    console.log('📋 Restoration Plan');
    console.log('=' .repeat(80));
    
    if (options.dryRun) {
      console.log('\n🔵 DRY RUN MODE - No files will be restored\n');
    }
    
    // Group by archive ID
    const byArchive = new Map<string, ScriptToRestore[]>();
    this.scriptsToRestore.forEach(script => {
      const existing = byArchive.get(script.archive_id) || [];
      existing.push(script);
      byArchive.set(script.archive_id, existing);
    });
    
    byArchive.forEach((scripts, archiveId) => {
      console.log(`\n📦 Archive: ${archiveId}`);
      console.log(`   Scripts: ${scripts.length}`);
      console.log(`   Date: ${new Date(scripts[0].archive_date).toLocaleDateString()}`);
      console.log(`   Files:`);
      
      scripts.forEach(script => {
        console.log(`     - ${script.original_path}`);
        if (script.archive_reason) {
          console.log(`       Reason: ${script.archive_reason}`);
        }
      });
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log(`Total scripts to restore: ${this.scriptsToRestore.length}`);
  }

  private async confirmRestore(): Promise<boolean> {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question('\nContinue with restoration? (yes/no): ', (answer: string) => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  private async performRestoration() {
    console.log('\n🔄 Restoring scripts...\n');
    
    for (const script of this.scriptsToRestore) {
      await this.restoreScript(script);
    }
    
    // Update database records
    if (this.restoredCount > 0) {
      const restoredIds = this.scriptsToRestore
        .filter(s => this.wasRestored(s))
        .map(s => s.id);
      
      const { error } = await this.supabase
        .from('sys_archived_scripts_files')
        .update({
          restored: true,
          restored_date: new Date().toISOString(),
          restored_by: 'batch-restore command'
        })
        .in('id', restoredIds);
        
      if (error) {
        console.error('Error updating database records:', error);
      }
    }
  }

  private async restoreScript(script: ScriptToRestore) {
    const archivedPath = path.join(this.projectRoot, script.archived_path);
    const originalPath = path.join(this.projectRoot, script.original_path);
    
    try {
      // Check if archived file exists
      if (!fs.existsSync(archivedPath)) {
        console.log(`❌ Archived file not found: ${script.archived_path}`);
        this.errorCount++;
        return;
      }
      
      // Check if target already exists
      if (fs.existsSync(originalPath)) {
        console.log(`⚠️  Skipped (file exists): ${script.original_path}`);
        this.skippedCount++;
        return;
      }
      
      // Create directory if needed
      const dir = path.dirname(originalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Copy file back
      fs.copyFileSync(archivedPath, originalPath);
      
      // Restore executable permissions for shell scripts
      if (script.original_path.endsWith('.sh')) {
        fs.chmodSync(originalPath, '755');
      }
      
      console.log(`✅ Restored: ${script.original_path}`);
      this.restoredCount++;
      
    } catch (error) {
      console.error(`❌ Error restoring ${script.original_path}:`, error);
      this.errorCount++;
    }
  }

  private wasRestored(script: ScriptToRestore): boolean {
    const originalPath = path.join(this.projectRoot, script.original_path);
    return fs.existsSync(originalPath);
  }

  private generateSummary(options: RestoreOptions) {
    console.log('\n' + '=' .repeat(80));
    console.log('📊 Restoration Summary\n');
    
    if (options.dryRun) {
      console.log('🔵 DRY RUN - No actual restoration performed');
      console.log(`   Would restore: ${this.scriptsToRestore.length} scripts`);
    } else {
      console.log(`✅ Successfully restored: ${this.restoredCount} scripts`);
      console.log(`⚠️  Skipped (already exist): ${this.skippedCount} scripts`);
      console.log(`❌ Errors: ${this.errorCount} scripts`);
      console.log(`📊 Total processed: ${this.scriptsToRestore.length} scripts`);
    }
    
    if (this.restoredCount > 0 && !options.dryRun) {
      console.log('\n💡 Next Steps:');
      console.log('1. Run validation to ensure no broken dependencies:');
      console.log('   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-imports');
      console.log('2. Test affected CLI commands and applications');
      console.log('3. Commit the restored files if everything works correctly');
    }
    
    // Save restoration report
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports',
      `batch-restoration-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    );
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      restoration_date: new Date().toISOString(),
      options: options,
      scripts_found: this.scriptsToRestore.length,
      restored_count: this.restoredCount,
      skipped_count: this.skippedCount,
      error_count: this.errorCount,
      scripts: this.scriptsToRestore.map(s => ({
        ...s,
        restored: this.wasRestored(s)
      }))
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// CLI setup
if (require.main === module) {
  const program = new Command();
  
  program
    .option('--archive-id <id>', 'Restore all scripts from a specific archive')
    .option('--category <type>', 'Restore scripts of a specific type (e.g., root_script, python)')
    .option('--date-range <start,end>', 'Restore scripts archived within date range (YYYY-MM-DD,YYYY-MM-DD)')
    .option('--dry-run', 'Show what would be restored without actually restoring')
    .option('--force', 'Skip confirmation prompt')
    .parse(process.argv);
  
  const options = program.opts() as RestoreOptions;
  
  if (!options.archiveId && !options.category && !options.dateRange) {
    console.error('Error: You must specify at least one filter (--archive-id, --category, or --date-range)');
    console.log('\nExamples:');
    console.log('  Restore by archive ID:');
    console.log('    ts-node restore-batch.ts --archive-id fix-scripts-phase1-20250608');
    console.log('\n  Restore by category:');
    console.log('    ts-node restore-batch.ts --category python');
    console.log('\n  Restore by date range:');
    console.log('    ts-node restore-batch.ts --date-range 2025-06-08,2025-06-08');
    console.log('\n  Dry run:');
    console.log('    ts-node restore-batch.ts --archive-id fix-scripts-phase1-20250608 --dry-run');
    process.exit(1);
  }
  
  const restorer = new BatchRestorer();
  restorer.restore(options).catch(console.error);
}