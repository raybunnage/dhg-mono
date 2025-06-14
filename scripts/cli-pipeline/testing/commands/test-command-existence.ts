#!/usr/bin/env ts-node

/**
 * Command Existence Test Runner
 * 
 * Tests that all commands listed in a pipeline's help actually exist and are executable.
 * This is the foundation of CLI pipeline testing.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface CommandExistenceTest {
  pipeline: string;
  command: string;
  exists: boolean;
  executable: boolean;
  helpListed: boolean;
  filePath?: string;
  error?: string;
}

interface TestSummary {
  pipeline: string;
  totalCommands: number;
  existingCommands: number;
  executableCommands: number;
  missingCommands: number;
  orphanedCommands: number;
  coverage: number;
  status: 'passed' | 'failed' | 'partial';
}

class CommandExistenceTester {
  private supabase = SupabaseClientService.getInstance().getClient();
  private pipelineRoot = path.join(__dirname, '../../../');
  
  /**
   * Test all commands for a specific pipeline
   */
  async testPipeline(pipelineName: string): Promise<TestSummary> {
    console.log(`\n🧪 Testing command existence for: ${pipelineName}`);
    console.log('=' . repeat(60));
    
    const results: CommandExistenceTest[] = [];
    
    try {
      // 1. Get commands from help
      const helpCommands = await this.getCommandsFromHelp(pipelineName);
      console.log(`📋 Found ${helpCommands.length} commands in help output`);
      
      // 2. Test each command
      for (const command of helpCommands) {
        const result = await this.testCommand(pipelineName, command);
        results.push(result);
        this.printResult(result);
      }
      
      // 3. Check for orphaned commands
      const orphanedCommands = await this.findOrphanedCommands(pipelineName, helpCommands);
      for (const orphaned of orphanedCommands) {
        results.push({
          pipeline: pipelineName,
          command: orphaned.command,
          exists: true,
          executable: orphaned.executable,
          helpListed: false,
          filePath: orphaned.filePath,
          error: 'Command exists but not listed in help'
        });
        this.printResult(results[results.length - 1]);
      }
      
      // 4. Generate summary
      const summary = this.generateSummary(pipelineName, results);
      this.printSummary(summary);
      
      // 5. Save results to database
      await this.saveResults(pipelineName, results, summary);
      
      return summary;
      
    } catch (error) {
      console.error(`❌ Failed to test pipeline ${pipelineName}:`, error);
      throw error;
    }
  }
  
  /**
   * Get commands from pipeline help output
   */
  private async getCommandsFromHelp(pipelineName: string): Promise<string[]> {
    const cliPath = path.join(this.pipelineRoot, pipelineName, `${pipelineName}-cli.sh`);
    
    if (!fs.existsSync(cliPath)) {
      throw new Error(`CLI script not found: ${cliPath}`);
    }
    
    try {
      const helpOutput = execSync(`${cliPath} --help`, { encoding: 'utf-8' });
      return this.parseCommandsFromHelp(helpOutput);
    } catch (error: any) {
      // Some CLIs exit with non-zero even on help
      if (error.stdout) {
        return this.parseCommandsFromHelp(error.stdout);
      }
      throw error;
    }
  }
  
  /**
   * Parse commands from help text
   */
  private parseCommandsFromHelp(helpText: string): string[] {
    const commands: string[] = [];
    const lines = helpText.split('\n');
    
    let inCommandSection = false;
    
    for (const line of lines) {
      // Detect command section
      if (line.match(/^(COMMANDS|Commands|AVAILABLE COMMANDS):/i)) {
        inCommandSection = true;
        continue;
      }
      
      // End of command section
      if (inCommandSection && line.match(/^(OPTIONS|EXAMPLES|USAGE):/i)) {
        break;
      }
      
      // Extract commands
      if (inCommandSection) {
        // Match patterns like:
        // - "command-name    Description"
        // - "  command-name  Description"
        // - "* command-name   Description" (frequently used)
        const match = line.match(/^\s*\*?\s*([a-z0-9-_]+)\s{2,}/i);
        if (match) {
          commands.push(match[1]);
        }
      }
    }
    
    // Remove common non-commands
    return commands.filter(cmd => 
      cmd !== 'help' && 
      cmd !== '--help' && 
      cmd !== 'version' &&
      cmd !== '--version'
    );
  }
  
  /**
   * Test if a command exists and is executable
   */
  private async testCommand(pipelineName: string, command: string): Promise<CommandExistenceTest> {
    const commandsDir = path.join(this.pipelineRoot, pipelineName, 'commands');
    
    // Common file patterns to check
    const possibleFiles = [
      `${command}.ts`,
      `${command}.js`,
      `${command}.sh`,
      `${command.replace(/-/g, '_')}.ts`,
      `${command.replace(/-/g, '_')}.js`,
    ];
    
    for (const file of possibleFiles) {
      const filePath = path.join(commandsDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const executable = (stats.mode & fs.constants.S_IXUSR) !== 0 || 
                          file.endsWith('.ts') || 
                          file.endsWith('.js');
        
        return {
          pipeline: pipelineName,
          command,
          exists: true,
          executable,
          helpListed: true,
          filePath
        };
      }
    }
    
    // Command not found
    return {
      pipeline: pipelineName,
      command,
      exists: false,
      executable: false,
      helpListed: true,
      error: 'Command file not found'
    };
  }
  
  /**
   * Find commands that exist but aren't in help
   */
  private async findOrphanedCommands(
    pipelineName: string, 
    helpCommands: string[]
  ): Promise<Array<{command: string, executable: boolean, filePath: string}>> {
    const commandsDir = path.join(this.pipelineRoot, pipelineName, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      return [];
    }
    
    const orphaned: Array<{command: string, executable: boolean, filePath: string}> = [];
    const files = fs.readdirSync(commandsDir);
    
    for (const file of files) {
      // Skip non-command files
      if (file.startsWith('.') || file.startsWith('_') || file.includes('.test.')) {
        continue;
      }
      
      // Extract command name
      const command = file.replace(/\.(ts|js|sh)$/, '').replace(/_/g, '-');
      
      // Check if it's in help
      if (!helpCommands.includes(command)) {
        const filePath = path.join(commandsDir, file);
        const stats = fs.statSync(filePath);
        const executable = (stats.mode & fs.constants.S_IXUSR) !== 0 || 
                          file.endsWith('.ts') || 
                          file.endsWith('.js');
        
        orphaned.push({ command, executable, filePath });
      }
    }
    
    return orphaned;
  }
  
  /**
   * Generate test summary
   */
  private generateSummary(pipelineName: string, results: CommandExistenceTest[]): TestSummary {
    const totalCommands = results.length;
    const existingCommands = results.filter(r => r.exists).length;
    const executableCommands = results.filter(r => r.executable).length;
    const missingCommands = results.filter(r => !r.exists && r.helpListed).length;
    const orphanedCommands = results.filter(r => r.exists && !r.helpListed).length;
    
    const coverage = totalCommands > 0 
      ? (existingCommands / results.filter(r => r.helpListed).length) * 100 
      : 0;
    
    let status: 'passed' | 'failed' | 'partial';
    if (missingCommands === 0 && orphanedCommands === 0) {
      status = 'passed';
    } else if (coverage >= 80) {
      status = 'partial';
    } else {
      status = 'failed';
    }
    
    return {
      pipeline: pipelineName,
      totalCommands,
      existingCommands,
      executableCommands,
      missingCommands,
      orphanedCommands,
      coverage,
      status
    };
  }
  
  /**
   * Print individual test result
   */
  private printResult(result: CommandExistenceTest): void {
    const icon = result.exists && result.executable ? '✅' : 
                 result.exists ? '⚠️' : '❌';
    
    const status = result.exists && result.executable ? 'OK' :
                   result.exists ? 'Not executable' :
                   'Missing';
    
    console.log(`  ${icon} ${result.command.padEnd(20)} ${status}`);
    
    if (result.error) {
      console.log(`     └─ ${result.error}`);
    }
  }
  
  /**
   * Print test summary
   */
  private printSummary(summary: TestSummary): void {
    console.log('\n📊 Test Summary:');
    console.log('─'.repeat(40));
    console.log(`Total Commands:      ${summary.totalCommands}`);
    console.log(`Existing Commands:   ${summary.existingCommands}`);
    console.log(`Executable Commands: ${summary.executableCommands}`);
    console.log(`Missing Commands:    ${summary.missingCommands}`);
    console.log(`Orphaned Commands:   ${summary.orphanedCommands}`);
    console.log(`Coverage:            ${summary.coverage.toFixed(1)}%`);
    console.log(`Status:              ${summary.status.toUpperCase()}`);
  }
  
  /**
   * Save results to database
   */
  private async saveResults(
    pipelineName: string, 
    results: CommandExistenceTest[], 
    summary: TestSummary
  ): Promise<void> {
    try {
      // Get pipeline ID
      const { data: pipeline } = await this.supabase
        .from('command_pipelines')
        .select('id')
        .eq('name', pipelineName)
        .single();
      
      if (!pipeline) {
        console.warn(`Pipeline ${pipelineName} not found in registry`);
        return;
      }
      
      // Save individual test results
      for (const result of results) {
        await this.supabase
          .from('cli_pipeline_test_results')
          .insert({
            pipeline_id: pipeline.id,
            test_type: 'existence',
            status: result.exists && result.executable ? 'passed' : 'failed',
            details: result
          });
      }
      
      // Update pipeline test status
      await this.supabase
        .from('command_pipelines')
        .update({
          test_coverage: summary.coverage,
          test_status: summary.status,
          last_test_run: new Date().toISOString()
        })
        .eq('id', pipeline.id);
      
      console.log('\n💾 Results saved to database');
      
    } catch (error) {
      console.error('Failed to save results:', error);
    }
  }
}

// Main execution
async function main() {
  const tester = new CommandExistenceTester();
  const pipeline = process.argv[2];
  
  if (!pipeline) {
    console.error('Usage: test-command-existence.ts <pipeline-name>');
    console.error('Example: test-command-existence.ts database');
    process.exit(1);
  }
  
  try {
    const summary = await tester.testPipeline(pipeline);
    process.exit(summary.status === 'passed' ? 0 : 1);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}