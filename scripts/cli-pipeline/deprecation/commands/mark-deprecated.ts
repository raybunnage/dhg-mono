#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function markDeprecated() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let type: string | null = null;
  let name: string | null = null;
  let reason: string | null = null;
  
  // Parse flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      type = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--reason' && args[i + 1]) {
      reason = args[i + 1];
      i++;
    }
  }
  
  // Interactive mode if not all args provided
  if (!type) {
    console.log('\n🏷️  Mark Item for Deprecation\n');
    type = await question('Type (service/script/command/pipeline): ');
  }
  
  if (!name) {
    name = await question('Name/Path: ');
  }
  
  if (!reason) {
    reason = await question('Deprecation reason: ');
  }
  
  rl.close();
  
  try {
    let updateResult;
    
    switch (type.toLowerCase()) {
      case 'service':
        updateResult = await deprecateService(supabase, name, reason);
        break;
        
      case 'script':
        updateResult = await deprecateScript(supabase, name, reason);
        break;
        
      case 'command':
        updateResult = await deprecateCommand(supabase, name, reason);
        break;
        
      case 'pipeline':
        updateResult = await deprecatePipeline(supabase, name, reason);
        break;
        
      default:
        console.error('❌ Invalid type. Must be: service, script, command, or pipeline');
        process.exit(1);
    }
    
    if (updateResult.success) {
      console.log(`\n✅ Successfully marked ${type} "${name}" as deprecated`);
      console.log(`📝 Reason: ${reason}`);
      
      if (updateResult.recommendations) {
        console.log('\n📋 Next Steps:');
        updateResult.recommendations.forEach((rec: string) => {
          console.log(`  - ${rec}`);
        });
      }
    } else {
      console.error(`\n❌ Failed to deprecate ${type}: ${updateResult.error}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function deprecateService(supabase: any, serviceName: string, reason: string) {
  // Find the service
  const { data: service, error: findError } = await supabase
    .from('registry_services')
    .select('*')
    .eq('service_name', serviceName)
    .single();
    
  if (findError || !service) {
    return { success: false, error: 'Service not found' };
  }
  
  // Update status to deprecated
  const { error: updateError } = await supabase
    .from('registry_services')
    .update({
      status: 'deprecated',
      deprecated_at: new Date().toISOString(),
      metadata: {
        ...service.metadata,
        deprecation_reason: reason
      }
    })
    .eq('id', service.id);
    
  if (updateError) {
    return { success: false, error: updateError.message };
  }
  
  // Check for dependencies
  const { data: dependencies } = await supabase
    .from('service_dependencies')
    .select('*')
    .eq('service_id', service.id);
    
  const recommendations = [
    `Archive the service files at: ${service.service_path}`,
    `Update CLAUDE.md to reflect the deprecation`
  ];
  
  if (dependencies && dependencies.length > 0) {
    recommendations.push(`⚠️  Warning: ${dependencies.length} items still depend on this service`);
    recommendations.push('Review and update dependent items before archiving');
  }
  
  return { success: true, recommendations };
}

async function deprecateScript(supabase: any, scriptPath: string, reason: string) {
  // Find the script
  const { data: script, error: findError } = await supabase
    .from('registry_scripts')
    .select('*')
    .or(`file_path.eq.${scriptPath},file_name.eq.${scriptPath}`)
    .single();
    
  if (findError || !script) {
    return { success: false, error: 'Script not found' };
  }
  
  // Update status
  const { error: updateError } = await supabase
    .from('registry_scripts')
    .update({
      status: 'deprecated',
      metadata: {
        ...script.metadata,
        deprecated_at: new Date().toISOString(),
        deprecation_reason: reason
      }
    })
    .eq('id', script.id);
    
  if (updateError) {
    return { success: false, error: updateError.message };
  }
  
  const dir = script.file_path.substring(0, script.file_path.lastIndexOf('/'));
  const recommendations = [
    `Create archive directory: mkdir -p ${dir}/.archived_scripts`,
    `Move script: mv ${script.file_path} ${dir}/.archived_scripts/${script.file_name}.${new Date().toISOString().split('T')[0]}`,
    `Update any references to this script in documentation or other scripts`
  ];
  
  return { success: true, recommendations };
}

async function deprecateCommand(supabase: any, commandName: string, reason: string) {
  // Parse pipeline:command format
  let pipelineName = null;
  let cmdName = commandName;
  
  if (commandName.includes(':')) {
    [pipelineName, cmdName] = commandName.split(':');
  }
  
  // Find the command
  let query = supabase
    .from('command_definitions')
    .select('*, command_pipelines(name)')
    .eq('command_name', cmdName);
    
  if (pipelineName) {
    query = query.eq('command_pipelines.name', pipelineName);
  }
  
  const { data: commands, error: findError } = await query;
  
  if (findError || !commands || commands.length === 0) {
    return { success: false, error: 'Command not found' };
  }
  
  if (commands.length > 1) {
    return { 
      success: false, 
      error: `Multiple commands found. Please specify pipeline:command format. Found in: ${commands.map((c: any) => c.command_pipelines?.name).join(', ')}`
    };
  }
  
  const command = commands[0];
  
  // Update status
  const { error: updateError } = await supabase
    .from('command_definitions')
    .update({
      status: 'deprecated',
      metadata: {
        ...command.metadata,
        deprecated_at: new Date().toISOString(),
        deprecation_reason: reason
      }
    })
    .eq('id', command.id);
    
  if (updateError) {
    return { success: false, error: updateError.message };
  }
  
  const recommendations = [
    `Update the CLI help text to indicate deprecation`,
    `Add a deprecation warning when the command is used`,
    `Update documentation to remove references to this command`,
    `Consider creating a migration guide for users`
  ];
  
  return { success: true, recommendations };
}

async function deprecatePipeline(supabase: any, pipelineName: string, reason: string) {
  // Find the pipeline
  const { data: pipeline, error: findError } = await supabase
    .from('command_pipelines')
    .select('*')
    .eq('name', pipelineName)
    .single();
    
  if (findError || !pipeline) {
    return { success: false, error: 'Pipeline not found' };
  }
  
  // Update status
  const { error: updateError } = await supabase
    .from('command_pipelines')
    .update({
      status: 'deprecated',
      metadata: {
        ...pipeline.metadata,
        deprecated_at: new Date().toISOString(),
        deprecation_reason: reason
      }
    })
    .eq('id', pipeline.id);
    
  if (updateError) {
    return { success: false, error: updateError.message };
  }
  
  // Also deprecate all commands in the pipeline
  const { error: cmdError } = await supabase
    .from('command_definitions')
    .update({
      status: 'deprecated',
      metadata: {
        deprecated_at: new Date().toISOString(),
        deprecation_reason: `Pipeline ${pipelineName} deprecated: ${reason}`
      }
    })
    .eq('pipeline_id', pipeline.id);
    
  if (cmdError) {
    console.warn('⚠️  Warning: Failed to deprecate some commands:', cmdError.message);
  }
  
  const recommendations = [
    `Archive the pipeline directory: scripts/cli-pipeline/${pipelineName}`,
    `Remove the pipeline from all_pipelines CLI menu`,
    `Update CLAUDE.md to remove this pipeline from the active list`,
    `Notify users of the deprecation and provide alternatives`
  ];
  
  return { success: true, recommendations };
}

// Run the deprecation marking
markDeprecated();