#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

interface UnimplementedCommand {
  pipeline_name: string;
  command_name: string;
  command_id?: string;
}

interface CleanupOptions {
  pipeline?: string;
  dryRun?: boolean;
  interactive?: boolean;
}

class CommandRegistryCleanup {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private unimplementedCommands: UnimplementedCommand[] = [];
  private commandsToRemove: UnimplementedCommand[] = [];

  async cleanup(options: CleanupOptions) {
    console.log('🧹 Command Registry Cleanup Tool\n');
    
    // Step 1: Load validation report
    await this.loadValidationReport();
    
    // Step 2: Get command IDs from database
    await this.enrichWithCommandIds();
    
    // Step 3: Analyze by pipeline
    this.analyzeByPipeline(options);
    
    // Step 4: Show cleanup plan
    this.showCleanupPlan();
    
    // Step 5: Execute cleanup if not dry run
    if (!options.dryRun) {
      await this.executeCleanup();
    }
  }

  private async loadValidationReport() {
    console.log('📄 Loading validation report...');
    
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports/cli-command-validation-2025-06-08.json'
    );
    
    if (!fs.existsSync(reportPath)) {
      console.error('❌ Validation report not found. Run validate-cli-commands first.');
      process.exit(1);
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    // Extract unimplemented commands
    this.unimplementedCommands = report.broken_commands
      .filter((cmd: any) => cmd.is_missing && !cmd.is_archived)
      .map((cmd: any) => ({
        pipeline_name: cmd.pipeline_name,
        command_name: cmd.command_name
      }));
    
    console.log(`  Found ${this.unimplementedCommands.length} unimplemented commands\n`);
  }

  private async enrichWithCommandIds() {
    console.log('🔍 Getting command IDs from database...');
    
    for (const cmd of this.unimplementedCommands) {
      const { data, error } = await this.supabase
        .from('command_definitions')
        .select('id, pipeline_id')
        .eq('command_name', cmd.command_name)
        .single();
      
      if (data && !error) {
        cmd.command_id = data.id;
      }
    }
    
    const withIds = this.unimplementedCommands.filter(cmd => cmd.command_id).length;
    console.log(`  Matched ${withIds} commands with database IDs\n`);
  }

  private analyzeByPipeline(options: CleanupOptions) {
    console.log('📊 Analyzing commands by pipeline...\n');
    
    // Group by pipeline
    const byPipeline = new Map<string, UnimplementedCommand[]>();
    this.unimplementedCommands.forEach(cmd => {
      const existing = byPipeline.get(cmd.pipeline_name) || [];
      existing.push(cmd);
      byPipeline.set(cmd.pipeline_name, existing);
    });
    
    // Show analysis
    const pipelinesToRemove = ['google_sync', 'merge', 'worktree', 'refactor_tracking', 'work_summaries'];
    
    byPipeline.forEach((commands, pipeline) => {
      console.log(`📦 ${pipeline}: ${commands.length} unimplemented commands`);
      
      // Check if entire pipeline should be removed
      if (pipelinesToRemove.includes(pipeline)) {
        console.log(`   ⚠️  Marked for pipeline removal`);
        this.commandsToRemove.push(...commands);
      } else if (commands.length > 10) {
        console.log(`   ⚠️  High number of unimplemented commands`);
        // For pipelines with many unimplemented commands, remove them
        this.commandsToRemove.push(...commands);
      } else {
        // For pipelines with few unimplemented commands, be selective
        commands.forEach(cmd => {
          // Remove obvious non-features like --options
          if (cmd.command_name.startsWith('--')) {
            this.commandsToRemove.push(cmd);
          }
        });
      }
    });
    
    console.log(`\n📊 Commands marked for removal: ${this.commandsToRemove.length}`);
  }

  private showCleanupPlan() {
    console.log('\n📋 Cleanup Plan');
    console.log('=' .repeat(80));
    
    // Group by pipeline for display
    const byPipeline = new Map<string, UnimplementedCommand[]>();
    this.commandsToRemove.forEach(cmd => {
      const existing = byPipeline.get(cmd.pipeline_name) || [];
      existing.push(cmd);
      byPipeline.set(cmd.pipeline_name, existing);
    });
    
    byPipeline.forEach((commands, pipeline) => {
      console.log(`\n📦 ${pipeline}`);
      commands.forEach(cmd => {
        console.log(`   - ${cmd.command_name}${cmd.command_id ? ' ✓' : ' (no ID)'}`);
      });
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log(`Total commands to remove: ${this.commandsToRemove.length}`);
    
    // Show pipelines that will become empty
    const pipelineCommandCounts = new Map<string, number>();
    this.unimplementedCommands.forEach(cmd => {
      pipelineCommandCounts.set(cmd.pipeline_name, (pipelineCommandCounts.get(cmd.pipeline_name) || 0) + 1);
    });
    
    console.log('\nPipelines that may need removal:');
    pipelineCommandCounts.forEach((count, pipeline) => {
      const removing = this.commandsToRemove.filter(cmd => cmd.pipeline_name === pipeline).length;
      if (removing === count) {
        console.log(`   - ${pipeline} (all ${count} commands being removed)`);
      }
    });
  }

  private async executeCleanup() {
    console.log('\n🔄 Executing cleanup...\n');
    
    let removed = 0;
    let failed = 0;
    
    for (const cmd of this.commandsToRemove) {
      if (!cmd.command_id) {
        console.log(`⚠️  Skipping ${cmd.pipeline_name}/${cmd.command_name} (no database ID)`);
        continue;
      }
      
      const { error } = await this.supabase
        .from('command_definitions')
        .delete()
        .eq('id', cmd.command_id);
      
      if (error) {
        console.error(`❌ Failed to remove ${cmd.pipeline_name}/${cmd.command_name}:`, error.message);
        failed++;
      } else {
        console.log(`✅ Removed ${cmd.pipeline_name}/${cmd.command_name}`);
        removed++;
      }
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`   Commands removed: ${removed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped (no ID): ${this.commandsToRemove.filter(c => !c.command_id).length}`);
    
    // Save cleanup report
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports',
      `command-cleanup-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportPath, JSON.stringify({
      cleanup_date: new Date().toISOString(),
      commands_removed: removed,
      failed: failed,
      removed_commands: this.commandsToRemove.filter(c => c.command_id),
      cleanup_details: this.commandsToRemove
    }, null, 2));
    
    console.log(`\n📄 Cleanup report saved to: ${reportPath}`);
  }
}

// CLI setup
if (require.main === module) {
  const program = new Command();
  
  program
    .option('--pipeline <name>', 'Clean only a specific pipeline')
    .option('--dry-run', 'Show what would be removed without removing')
    .option('--interactive', 'Interactively choose commands to remove')
    .parse(process.argv);
  
  const options = program.opts() as CleanupOptions;
  
  const cleaner = new CommandRegistryCleanup();
  cleaner.cleanup(options).catch(console.error);
}