#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface PipelineInfo {
  name: string;
  description: string;
  path: string;
}

interface CommandInfo {
  pipeline: string;
  command: string;
  description: string;
  file_path: string;
}

// Define all pipelines in the CLI system
const pipelines: PipelineInfo[] = [
  { name: 'ai', description: 'AI and Claude service commands', path: 'ai' },
  { name: 'all_pipelines', description: 'Cross-pipeline utilities and management', path: 'all_pipelines' },
  { name: 'analysis', description: 'Script and code analysis commands', path: 'analysis' },
  { name: 'auth', description: 'Authentication and user management', path: 'auth' },
  { name: 'classify', description: 'Document classification commands', path: 'classify' },
  { name: 'database', description: 'Database management and migrations', path: 'database' },
  { name: 'dev_tasks', description: 'Development task tracking', path: 'dev_tasks' },
  { name: 'document', description: 'Document processing and management', path: 'document' },
  { name: 'document_types', description: 'Document type management', path: 'document_types' },
  { name: 'drive_filter', description: 'Google Drive filter profiles', path: 'drive_filter' },
  { name: 'experts', description: 'Expert profile management', path: 'experts' },
  { name: 'gmail', description: 'Gmail email synchronization and processing', path: 'gmail' },
  { name: 'google_sync', description: 'Google Drive synchronization', path: 'google_sync' },
  { name: 'media-processing', description: 'Media file processing and transcription', path: 'media-processing' },
  { name: 'mime_types', description: 'MIME type configuration', path: 'mime_types' },
  { name: 'monitoring', description: 'System monitoring and health checks', path: 'monitoring' },
  { name: 'presentations', description: 'Presentation management and processing', path: 'presentations' },
  { name: 'prompt_service', description: 'AI prompt management', path: 'prompt_service' },
  { name: 'proxy', description: 'Proxy server management and monitoring', path: 'proxy' },
  { name: 'refactor_tracking', description: 'Code refactoring tracking', path: 'refactor_tracking' },
  { name: 'scripts', description: 'Script registry and management', path: 'scripts' },
  { name: 'tracking', description: 'Command usage tracking', path: 'tracking' },
  { name: 'work_summaries', description: 'AI work summary management', path: 'work_summaries' }
];

async function scanPipelineCommands(pipelineInfo: PipelineInfo): Promise<CommandInfo[]> {
  const commands: CommandInfo[] = [];
  const pipelinePath = path.join(__dirname, '..', pipelineInfo.path);
  
  // Look for the CLI shell script to extract commands
  const cliScriptPath = path.join(pipelinePath, `${pipelineInfo.name.replace('_', '-')}-cli.sh`);
  
  if (fs.existsSync(cliScriptPath)) {
    const content = fs.readFileSync(cliScriptPath, 'utf-8');
    
    // Extract commands from case statements
    const caseMatches = content.matchAll(/^\s*"?([a-z-]+)"?\)\s*$/gm);
    for (const match of caseMatches) {
      const command = match[1];
      if (command && !command.includes('help') && command !== '*') {
        // Try to find description from help text
        const helpPattern = new RegExp(`${command}[^\\n]*\\n[^\\n]*#\\s*(.+)`, 'i');
        const helpMatch = content.match(helpPattern);
        const description = helpMatch ? helpMatch[1].trim() : `${command} command`;
        
        commands.push({
          pipeline: pipelineInfo.name,
          command: command,
          description: description,
          file_path: `scripts/cli-pipeline/${pipelineInfo.path}/${command}.ts`
        });
      }
    }
  }
  
  // Also scan commands directory if it exists
  const commandsDir = path.join(pipelinePath, 'commands');
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir);
    for (const file of files) {
      if (file.endsWith('.ts') && !file.includes('.test.')) {
        const command = file.replace('.ts', '');
        // Check if we already have this command
        if (!commands.find(c => c.command === command)) {
          commands.push({
            pipeline: pipelineInfo.name,
            command: command,
            description: `${command.replace(/-/g, ' ')} command`,
            file_path: `scripts/cli-pipeline/${pipelineInfo.path}/commands/${file}`
          });
        }
      }
    }
  }
  
  return commands;
}

async function populateRegistry() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Populating command registry...\n');
  
  // First, ensure all pipelines are in command_pipelines table
  console.log('Updating command_pipelines table...');
  for (const pipeline of pipelines) {
    const { error } = await supabase
      .from('command_pipelines')
      .upsert({
        name: pipeline.name,
        display_name: pipeline.name.replace(/-/g, ' ').replace(/_/g, ' '),
        description: pipeline.description,
        script_path: `scripts/cli-pipeline/${pipeline.path}/${pipeline.name.replace('_', '-')}-cli.sh`,
        status: 'active'
      }, {
        onConflict: 'name'
      });
      
    if (error) {
      console.error(`Error upserting pipeline ${pipeline.name}:`, error);
    } else {
      console.log(`✓ ${pipeline.name}`);
    }
  }
  
  console.log('\nScanning for commands...');
  
  // Scan each pipeline for commands
  let totalCommands = 0;
  for (const pipeline of pipelines) {
    const commands = await scanPipelineCommands(pipeline);
    
    if (commands.length > 0) {
      console.log(`\n${pipeline.name}: ${commands.length} commands found`);
      
      // Insert commands into registry
      for (const cmd of commands) {
        // First get the pipeline_id
        const { data: pipelineData } = await supabase
          .from('command_pipelines')
          .select('id')
          .eq('name', cmd.pipeline)
          .single();
          
        if (pipelineData) {
          const { error } = await supabase
            .from('command_definitions')
            .upsert({
              pipeline_id: pipelineData.id,
              command_name: cmd.command,
              description: cmd.description,
              usage_pattern: `${cmd.command} [options]`,
              example_usage: `./${cmd.pipeline.replace('_', '-')}-cli.sh ${cmd.command}`,
              requires_auth: true,
              requires_google_api: cmd.pipeline === 'google_sync',
              is_dangerous: ['delete', 'purge', 'clean', 'reset'].some(word => cmd.command.includes(word)),
              display_order: 0
            }, {
              onConflict: 'pipeline_id,command_name'
            });
            
          if (error) {
            console.error(`  ✗ ${cmd.command}: ${error.message}`);
          } else {
            console.log(`  ✓ ${cmd.command}`);
            totalCommands++;
          }
        }
      }
    }
  }
  
  console.log(`\nTotal commands registered: ${totalCommands}`);
  
  // Show summary
  const { data: pipelineStats } = await supabase
    .from('command_pipelines')
    .select(`
      name,
      command_definitions (
        command_name
      )
    `)
    .order('name');
    
  console.log('\nCommand count by pipeline:');
  pipelineStats?.forEach((pipeline: any) => {
    const commandCount = pipeline.command_definitions?.length || 0;
    if (commandCount > 0) {
      console.log(`  ${pipeline.name}: ${commandCount}`);
    }
  });
}

// Run the population script
populateRegistry().catch(console.error);