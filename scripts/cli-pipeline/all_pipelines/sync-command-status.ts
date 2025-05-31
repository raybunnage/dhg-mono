#!/usr/bin/env ts-node

/**
 * Sync Command Status Script
 * 
 * This script scans CLI pipeline files and updates the command registry
 * to mark deprecated commands and verify active ones.
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Pipeline {
  id: string;
  name: string;
  script_path: string;
}

interface Command {
  id: string;
  command_name: string;
  pipeline_id: string;
  status: string;
}

class CommandStatusSyncer {
  private supabase = SupabaseClientService.getInstance().getClient();

  async sync() {
    console.log('🔍 Starting command status sync...\n');

    try {
      // Get all active pipelines
      const { data: pipelines, error: pipelineError } = await this.supabase
        .from('command_pipelines')
        .select('id, name, script_path')
        .eq('status', 'active');

      if (pipelineError) {
        throw new Error(`Failed to fetch pipelines: ${pipelineError.message}`);
      }

      if (!pipelines || pipelines.length === 0) {
        console.log('No active pipelines found.');
        return;
      }

      console.log(`Found ${pipelines.length} active pipelines\n`);

      // Process each pipeline
      for (const pipeline of pipelines) {
        await this.processPipeline(pipeline);
      }

      console.log('\n✅ Command status sync completed');
      
    } catch (error) {
      console.error('❌ Error during sync:', error);
      process.exit(1);
    }
  }

  private async processPipeline(pipeline: Pipeline) {
    console.log(`\n📦 Processing pipeline: ${pipeline.name}`);
    console.log(`   Script: ${pipeline.script_path}`);

    try {
      // Build the full path
      const scriptPath = path.join(process.cwd(), pipeline.script_path);
      
      // Check if file exists
      try {
        await fs.access(scriptPath);
      } catch {
        console.log(`   ⚠️  Script file not found - marking pipeline as deprecated`);
        await this.deprecatePipeline(pipeline.id);
        return;
      }

      // Read and parse the script file
      const scriptContent = await fs.readFile(scriptPath, 'utf-8');
      const commands = this.extractCommands(scriptContent, pipeline.script_path);

      console.log(`   Found ${commands.length} commands in script`);

      // Get existing commands from database
      const { data: dbCommands, error: cmdError } = await this.supabase
        .from('command_definitions')
        .select('id, command_name, status')
        .eq('pipeline_id', pipeline.id);

      if (cmdError) {
        throw new Error(`Failed to fetch commands: ${cmdError.message}`);
      }

      const dbCommandMap = new Map(
        (dbCommands || []).map(cmd => [cmd.command_name, cmd])
      );

      // Track statistics
      let newCommands = 0;
      let verifiedCommands = 0;
      let deprecatedCommands = 0;

      // Process commands found in script
      for (const cmdName of commands) {
        const dbCmd = dbCommandMap.get(cmdName);
        
        if (!dbCmd) {
          // New command - would need to be added manually or through another process
          console.log(`   📝 New command found: ${cmdName} (needs manual addition)`);
          newCommands++;
        } else if (dbCmd.status !== 'active') {
          // Reactivate command
          await this.reactivateCommand(dbCmd.id, cmdName);
          console.log(`   ♻️  Reactivated command: ${cmdName}`);
          verifiedCommands++;
        } else {
          // Verify active command
          await this.verifyCommand(dbCmd.id);
          verifiedCommands++;
        }
        
        // Remove from map to track what's left
        dbCommandMap.delete(cmdName);
      }

      // Remaining commands in map are not in script - deprecate them
      for (const [cmdName, cmd] of dbCommandMap) {
        if (cmd.status === 'active') {
          await this.deprecateCommand(cmd.id, cmdName);
          deprecatedCommands++;
        }
      }

      console.log(`   ✓ Verified: ${verifiedCommands}, New: ${newCommands}, Deprecated: ${deprecatedCommands}`);

    } catch (error) {
      console.error(`   ❌ Error processing pipeline: ${error}`);
    }
  }

  private extractCommands(scriptContent: string, scriptPath: string): string[] {
    const commands: string[] = [];
    
    // Extract commands based on file type
    if (scriptPath.endsWith('.sh')) {
      // For shell scripts, look for case statements
      const caseRegex = /^\s*["']?([a-z-]+)["']?\s*\)/gm;
      let match;
      
      // Find the case statement block
      const caseBlockMatch = scriptContent.match(/case\s+"\$command"\s+in([\s\S]*?)esac/);
      if (caseBlockMatch) {
        const caseBlock = caseBlockMatch[1];
        while ((match = caseRegex.exec(caseBlock)) !== null) {
          const cmd = match[1];
          // Filter out common non-command patterns
          if (!['*', '--help', '-h', 'help'].includes(cmd)) {
            commands.push(cmd);
          }
        }
      }
    } else if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      // For TypeScript/JavaScript, look for commander commands
      const commandRegex = /\.command\(['"]([a-z-]+)(?:\s|['"])/g;
      let match;
      
      while ((match = commandRegex.exec(scriptContent)) !== null) {
        commands.push(match[1]);
      }
    }

    // Remove duplicates
    return [...new Set(commands)];
  }

  private async deprecatePipeline(pipelineId: string) {
    const { error } = await this.supabase
      .from('command_pipelines')
      .update({ 
        status: 'deprecated',
        updated_at: new Date().toISOString()
      })
      .eq('id', pipelineId);

    if (error) {
      console.error(`Failed to deprecate pipeline: ${error.message}`);
    }
  }

  private async deprecateCommand(commandId: string, commandName: string) {
    const { error } = await this.supabase
      .from('command_definitions')
      .update({ 
        status: 'deprecated',
        deprecated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (error) {
      console.error(`Failed to deprecate command ${commandName}: ${error.message}`);
    } else {
      console.log(`   🚫 Deprecated command: ${commandName}`);
    }
  }

  private async reactivateCommand(commandId: string, commandName: string) {
    const { error } = await this.supabase
      .from('command_definitions')
      .update({ 
        status: 'active',
        deprecated_at: null,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (error) {
      console.error(`Failed to reactivate command ${commandName}: ${error.message}`);
    }
  }

  private async verifyCommand(commandId: string) {
    const { error } = await this.supabase
      .from('command_definitions')
      .update({ 
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (error) {
      console.error(`Failed to verify command: ${error.message}`);
    }
  }
}

// Run the sync
if (require.main === module) {
  const syncer = new CommandStatusSyncer();
  syncer.sync();
}