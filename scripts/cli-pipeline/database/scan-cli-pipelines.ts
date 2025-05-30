#!/usr/bin/env ts-node

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { CLIRegistryService } from '../../../packages/shared/services/cli-registry-service';

const supabase = SupabaseClientService.getInstance().getClient();
const registryService = new CLIRegistryService(supabase);

interface ExtractedCommand {
  name: string;
  description: string;
  usage?: string;
}

async function extractCommandsFromScript(scriptPath: string): Promise<ExtractedCommand[]> {
  try {
    const content = await readFile(scriptPath, 'utf-8');
    const commands: ExtractedCommand[] = [];
    
    // Look for AVAILABLE COMMANDS section
    const commandsMatch = content.match(/AVAILABLE COMMANDS:([\s\S]*?)(\n\n|#)/);
    if (commandsMatch) {
      const commandsSection = commandsMatch[1];
      const lines = commandsSection.split('\n');
      
      for (const line of lines) {
        // Match patterns like: "  sync                         Sync files from Google Drive..."
        const match = line.match(/^\s*#?\s*(\S+)\s{2,}(.+)$/);
        if (match) {
          const [, cmdName, description] = match;
          if (cmdName && !cmdName.startsWith('#')) {
            commands.push({
              name: cmdName,
              description: description.trim()
            });
          }
        }
      }
    }
    
    // Also look for case statements for commands
    const caseMatches = content.matchAll(/^\s*["']?([a-z-]+)["']?\)\s*$/gm);
    const caseCommands = new Set<string>();
    for (const match of caseMatches) {
      if (match[1] && !match[1].includes('$')) {
        caseCommands.add(match[1]);
      }
    }
    
    // Add any case commands not found in AVAILABLE COMMANDS
    for (const cmd of caseCommands) {
      if (!commands.find(c => c.name === cmd)) {
        commands.push({
          name: cmd,
          description: `Command: ${cmd}`
        });
      }
    }
    
    return commands;
  } catch (error) {
    console.error(`Error reading script ${scriptPath}:`, error);
    return [];
  }
}

async function getCategoryForPipeline(pipelineName: string): Promise<string | undefined> {
  const categoryMap: { [key: string]: string } = {
    'google_sync': 'data_sync',
    'document': 'document_processing',
    'document_types': 'document_processing',
    'classify': 'document_processing',
    'database': 'database_management',
    'auth': 'authentication',
    'monitoring': 'monitoring',
    'tracking': 'monitoring',
    'ai': 'ai_services',
    'prompt_service': 'ai_services',
    'media-processing': 'media',
    'presentations': 'media',
    'dev_tasks': 'development',
    'work_summaries': 'development',
    'refactor_tracking': 'development',
    'scripts': 'development',
    'experts': 'document_processing',
    'mime_types': 'database_management',
    'drive_filter': 'data_sync'
  };
  
  const categories = await registryService.getCategories();
  const categoryName = categoryMap[pipelineName];
  const category = categories.find(c => c.name === categoryName);
  return category?.id;
}

async function scanCLIPipelines() {
  console.log('🔍 Scanning CLI pipelines...\n');
  
  try {
    const pipelinesDir = join(__dirname, '..');
    const entries = await readdir(pipelinesDir, { withFileTypes: true });
    
    let pipelineCount = 0;
    let commandCount = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pipelineName = entry.name;
        const cliScriptPath = join(pipelinesDir, pipelineName, `${pipelineName}-cli.sh`);
        
        try {
          // Check if CLI script exists
          const scriptContent = await readFile(cliScriptPath, 'utf-8');
          console.log(`\n📂 Processing pipeline: ${pipelineName}`);
          
          // Extract description from script header
          const descMatch = scriptContent.match(/# ([^#\n]+)\n/);
          const description = descMatch ? descMatch[1].trim() : `CLI pipeline for ${pipelineName}`;
          
          // Get category
          const categoryId = await getCategoryForPipeline(pipelineName);
          
          // Create or update pipeline
          let pipeline = await registryService.getPipelineByName(pipelineName);
          if (!pipeline) {
            pipeline = await registryService.createPipeline({
              name: pipelineName,
              display_name: pipelineName.replace(/_/g, ' ').replace(/-/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
              description,
              category_id: categoryId,
              script_path: `scripts/cli-pipeline/${pipelineName}/${pipelineName}-cli.sh`,
              status: 'active'
            });
            console.log(`  ✅ Created pipeline: ${pipeline.display_name}`);
            pipelineCount++;
          } else {
            console.log(`  ℹ️  Pipeline already exists: ${pipeline.display_name}`);
          }
          
          // Extract and import commands
          const commands = await extractCommandsFromScript(cliScriptPath);
          if (commands.length > 0) {
            console.log(`  📋 Found ${commands.length} commands`);
            await registryService.importPipelineCommands(pipelineName, commands);
            commandCount += commands.length;
          }
          
          // Mark as scanned
          await registryService.markPipelineScanned(pipeline.id);
          
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // No CLI script for this directory
            continue;
          }
          console.error(`  ❌ Error processing ${pipelineName}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Scan complete!');
    console.log(`   📂 Pipelines processed: ${pipelineCount}`);
    console.log(`   📋 Commands imported: ${commandCount}`);
    
  } catch (error) {
    console.error('❌ Error scanning pipelines:', error);
    process.exit(1);
  }
}

// Run the scanner
scanCLIPipelines().catch(console.error);