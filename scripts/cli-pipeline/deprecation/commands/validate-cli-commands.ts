#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface BrokenCommand {
  pipeline_name: string;
  command_name: string;
  script_path: string;
  error: string;
  is_missing: boolean;
  is_archived: boolean;
  archive_info?: {
    archive_id: string;
    archive_date: Date;
    archive_reason: string;
  };
}

class CLICommandValidator {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private brokenCommands: BrokenCommand[] = [];
  private archivedScripts: Map<string, any> = new Map();

  async validate() {
    console.log('🔍 Validating CLI commands...\n');
    
    // Step 1: Load archived scripts
    await this.loadArchivedScripts();
    
    // Step 2: Get all CLI pipelines and commands
    const pipelines = await this.getCliPipelines();
    
    // Step 3: Validate each pipeline
    for (const pipeline of pipelines) {
      await this.validatePipeline(pipeline);
    }
    
    // Step 4: Check shell script syntax
    await this.validateShellScripts();
    
    // Step 5: Generate report
    this.generateReport();
  }

  private async loadArchivedScripts() {
    console.log('📚 Loading archived scripts...');
    
    const { data, error } = await this.supabase
      .from('sys_archived_scripts_files')
      .select('*')
      .eq('restored', false);
      
    if (error) {
      console.error('Error loading archived scripts:', error);
      return;
    }
    
    data?.forEach(script => {
      this.archivedScripts.set(script.original_path, script);
    });
    
    console.log(`  Loaded ${data?.length || 0} archived scripts\n`);
  }

  private async getCliPipelines() {
    console.log('🔗 Loading CLI pipelines...');
    
    const { data: pipelines, error } = await this.supabase
      .from('command_pipelines')
      .select(`
        *,
        command_definitions (*)
      `)
      .eq('status', 'active')
      .order('name');
      
    if (error) {
      console.error('Error loading pipelines:', error);
      return [];
    }
    
    console.log(`  Found ${pipelines?.length || 0} active pipelines\n`);
    return pipelines || [];
  }

  private async validatePipeline(pipeline: any) {
    console.log(`📦 Validating pipeline: ${pipeline.name}`);
    
    // Check if the main CLI script exists
    const cliScriptPath = `scripts/cli-pipeline/${pipeline.name}/${pipeline.name}-cli.sh`;
    const fullPath = path.join(this.projectRoot, cliScriptPath);
    
    if (!fs.existsSync(fullPath)) {
      if (this.archivedScripts.has(cliScriptPath)) {
        const archiveInfo = this.archivedScripts.get(cliScriptPath);
        this.brokenCommands.push({
          pipeline_name: pipeline.name,
          command_name: 'main CLI script',
          script_path: cliScriptPath,
          error: 'Main CLI script has been archived',
          is_missing: true,
          is_archived: true,
          archive_info: {
            archive_id: archiveInfo.archive_id,
            archive_date: new Date(archiveInfo.archive_date),
            archive_reason: archiveInfo.archive_reason
          }
        });
      } else {
        this.brokenCommands.push({
          pipeline_name: pipeline.name,
          command_name: 'main CLI script',
          script_path: cliScriptPath,
          error: 'Main CLI script not found',
          is_missing: true,
          is_archived: false
        });
      }
    }
    
    // Check each command in the pipeline
    const commands = pipeline.command_definitions || [];
    let validCount = 0;
    let brokenCount = 0;
    
    for (const command of commands) {
      const isValid = await this.validateCommand(pipeline.name, command);
      if (isValid) {
        validCount++;
      } else {
        brokenCount++;
      }
    }
    
    console.log(`  ✅ Valid commands: ${validCount}`);
    console.log(`  ❌ Broken commands: ${brokenCount}\n`);
  }

  private async validateCommand(pipelineName: string, command: any): Promise<boolean> {
    // Commands might reference scripts in different ways
    // Check common patterns
    const possiblePaths = [
      `scripts/cli-pipeline/${pipelineName}/commands/${command.command_name}.ts`,
      `scripts/cli-pipeline/${pipelineName}/commands/${command.command_name}.js`,
      `scripts/cli-pipeline/${pipelineName}/${command.command_name}.ts`,
      `scripts/cli-pipeline/${pipelineName}/${command.command_name}.js`,
      `scripts/cli-pipeline/${pipelineName}/${command.command_name}.sh`
    ];
    
    let found = false;
    let scriptPath = '';
    
    for (const pathToCheck of possiblePaths) {
      const fullPath = path.join(this.projectRoot, pathToCheck);
      if (fs.existsSync(fullPath)) {
        found = true;
        scriptPath = pathToCheck;
        break;
      }
    }
    
    if (!found) {
      // Check if it was archived
      for (const pathToCheck of possiblePaths) {
        if (this.archivedScripts.has(pathToCheck)) {
          const archiveInfo = this.archivedScripts.get(pathToCheck);
          this.brokenCommands.push({
            pipeline_name: pipelineName,
            command_name: command.command_name,
            script_path: pathToCheck,
            error: 'Command script has been archived',
            is_missing: true,
            is_archived: true,
            archive_info: {
              archive_id: archiveInfo.archive_id,
              archive_date: new Date(archiveInfo.archive_date),
              archive_reason: archiveInfo.archive_reason
            }
          });
          return false;
        }
      }
      
      // Not found and not archived
      this.brokenCommands.push({
        pipeline_name: pipelineName,
        command_name: command.command_name,
        script_path: possiblePaths[0], // Use first as reference
        error: 'Command script not found',
        is_missing: true,
        is_archived: false
      });
      return false;
    }
    
    return true;
  }

  private async validateShellScripts() {
    console.log('🐚 Validating shell script syntax...');
    
    const shellScripts = await new Promise<string[]>((resolve, reject) => {
      const glob = require('glob');
      glob('scripts/cli-pipeline/**/*.sh', {
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**', '**/.archived_scripts/**']
      }, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    
    let validCount = 0;
    let syntaxErrorCount = 0;
    
    for (const script of shellScripts) {
      const fullPath = path.join(this.projectRoot, script);
      
      try {
        // Use bash -n to check syntax without executing
        execSync(`bash -n "${fullPath}"`, { stdio: 'pipe' });
        validCount++;
      } catch (error: any) {
        syntaxErrorCount++;
        const pipelineName = script.split('/')[2]; // Extract pipeline name
        
        this.brokenCommands.push({
          pipeline_name: pipelineName,
          command_name: path.basename(script),
          script_path: script,
          error: `Syntax error: ${error.message}`,
          is_missing: false,
          is_archived: false
        });
      }
    }
    
    console.log(`  Checked ${shellScripts.length} shell scripts`);
    console.log(`  ✅ Valid syntax: ${validCount}`);
    console.log(`  ❌ Syntax errors: ${syntaxErrorCount}\n`);
  }

  private generateReport() {
    console.log('📝 CLI Command Validation Report');
    console.log('=' .repeat(80));
    
    if (this.brokenCommands.length === 0) {
      console.log('\n✅ SUCCESS: All CLI commands are valid!');
      console.log('\nNo broken commands or missing scripts found.\n');
      return;
    }
    
    console.log(`\n⚠️  WARNING: Found ${this.brokenCommands.length} broken commands\n`);
    
    // Group by pipeline
    const byPipeline = new Map<string, BrokenCommand[]>();
    this.brokenCommands.forEach(cmd => {
      const existing = byPipeline.get(cmd.pipeline_name) || [];
      existing.push(cmd);
      byPipeline.set(cmd.pipeline_name, existing);
    });
    
    // Display grouped results
    byPipeline.forEach((commands, pipelineName) => {
      console.log(`\n📦 Pipeline: ${pipelineName}`);
      console.log(`   Broken commands: ${commands.length}\n`);
      
      commands.forEach(cmd => {
        console.log(`   ❌ ${cmd.command_name}`);
        console.log(`      Script: ${cmd.script_path}`);
        console.log(`      Error: ${cmd.error}`);
        
        if (cmd.is_archived && cmd.archive_info) {
          console.log(`      Archive ID: ${cmd.archive_info.archive_id}`);
          console.log(`      Archive Date: ${cmd.archive_info.archive_date.toLocaleDateString()}`);
          console.log(`      Reason: ${cmd.archive_info.archive_reason}`);
        }
        console.log('');
      });
    });
    
    // Count archived vs missing
    const archivedCount = this.brokenCommands.filter(c => c.is_archived).length;
    const missingCount = this.brokenCommands.filter(c => !c.is_archived && c.is_missing).length;
    const syntaxErrorCount = this.brokenCommands.filter(c => !c.is_missing).length;
    
    console.log('\n📊 Summary:');
    console.log(`   Scripts archived: ${archivedCount}`);
    console.log(`   Scripts missing: ${missingCount}`);
    console.log(`   Syntax errors: ${syntaxErrorCount}`);
    
    if (archivedCount > 0) {
      console.log('\n💡 To restore archived command scripts:');
      
      // Get unique archive IDs
      const archiveIds = new Set<string>();
      this.brokenCommands
        .filter(c => c.is_archived && c.archive_info)
        .forEach(c => archiveIds.add(c.archive_info!.archive_id));
      
      archiveIds.forEach(id => {
        console.log(`   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id ${id}`);
      });
    }
    
    // Save detailed report
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports',
      `cli-command-validation-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      validation_date: new Date().toISOString(),
      total_pipelines_checked: byPipeline.size,
      broken_commands_count: this.brokenCommands.length,
      summary: {
        archived: archivedCount,
        missing: missingCount,
        syntax_errors: syntaxErrorCount
      },
      broken_commands: this.brokenCommands,
      grouped_by_pipeline: Object.fromEntries(byPipeline)
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the validator
if (require.main === module) {
  const validator = new CLICommandValidator();
  validator.validate().catch(console.error);
}