#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Database } from '../../../../supabase/types';

type ServerRegistry = Database['public']['Tables']['sys_server_ports_registry']['Row'];
type ServerRegistryUpdate = Database['public']['Tables']['sys_server_ports_registry']['Update'];

// Server configurations from start-all-servers.js
const SERVER_CONFIGS = [
  {
    service_name: 'md-server',
    display_name: 'Markdown Server',
    port: 3001,
    description: 'Serves markdown files for all apps',
    metadata: {
      script_path: 'scripts/cli-pipeline/viewers/simple-md-server.js'
    }
  },
  {
    service_name: 'script-server',
    display_name: 'Script Server',
    port: 3002,
    description: 'Serves script files (.sh, .js, .ts, .py)',
    metadata: {
      script_path: 'scripts/cli-pipeline/viewers/simple-script-server.js'
    }
  },
  {
    service_name: 'docs-archive-server',
    display_name: 'Docs Archive Server',
    port: 3003,
    description: 'Document archiving and retrieval',
    metadata: {
      script_path: 'scripts/cli-pipeline/viewers/docs-archive-server.js'
    }
  },
  {
    service_name: 'git-server',
    display_name: 'Git Server',
    port: 3005,
    description: 'Git worktree management',
    metadata: {
      script_path: 'apps/dhg-admin-code/git-server.cjs'
    }
  },
  {
    service_name: 'web-google-drive-audio',
    display_name: 'Web Audio Server',
    port: 3006,
    description: 'Web Google Drive audio API (works anywhere)',
    metadata: {
      script_path: 'apps/dhg-audio/server.js',
      env_var: 'PORT'
    }
  },
  {
    service_name: 'local-google-drive-audio',
    display_name: 'Local Audio Server',
    port: 3007,
    description: 'Local Google Drive audio (10-100x faster)',
    metadata: {
      script_path: 'apps/dhg-audio/server-enhanced.js',
      env_var: 'PORT'
    }
  },
  {
    service_name: 'living-docs-server',
    display_name: 'Living Docs Server',
    port: 3008,
    description: 'Living documentation tracking',
    metadata: {
      script_path: 'apps/dhg-admin-code/living-docs-server.cjs'
    }
  },
  {
    service_name: 'git-api-server',
    display_name: 'Git API Server',
    port: 3009,
    description: 'Git branch management API',
    metadata: {
      script_path: 'apps/dhg-admin-code/git-api-server.cjs',
      env_var: 'GIT_API_PORT'
    }
  },
  {
    service_name: 'worktree-switcher',
    display_name: 'Worktree Switcher',
    port: 3010,
    description: 'Visual worktree switcher for Cursor instances',
    metadata: {
      script_path: 'scripts/cli-pipeline/viewers/worktree-switcher-server.js',
      env_var: 'WORKTREE_SWITCHER_PORT'
    }
  },
  {
    service_name: 'git-history-server',
    display_name: 'Git History Analysis Server',
    port: 3011,
    description: 'Git history analysis and worktree assignment',
    metadata: {
      script_path: 'scripts/cli-pipeline/dev_tasks/git-history-server.js',
      env_var: 'GIT_HISTORY_PORT'
    }
  },
  {
    service_name: 'test-runner-server',
    display_name: 'Test Runner Server',
    port: 3012,
    description: 'Test execution API for dhg-admin-code',
    metadata: {
      script_path: 'apps/dhg-admin-code/test-runner-server.cjs',
      env_var: 'TEST_RUNNER_PORT'
    }
  }
];

function getHealthCheckEndpoint(serviceName: string): string | null {
  const healthEndpoints: Record<string, string> = {
    'test-runner-server': '/api/health',
    'living-docs-server': '/api/health',
    'git-api-server': '/api/health',
    'git-server': '/api/health',
    'md-server': '/health',
    'script-server': '/health',
    'docs-archive-server': '/health'
  };
  
  return healthEndpoints[serviceName] || null;
}

async function populateRegistry() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Populating server registry with startup configurations...\n');
  
  for (const config of SERVER_CONFIGS) {
    console.log(`Updating ${config.display_name}...`);
    
    const update: ServerRegistryUpdate = {
      display_name: config.display_name,
      port: config.port,
      description: config.description,
      metadata: config.metadata as any,
      status: 'inactive',
      environment: 'development',
      protocol: 'http',
      host: 'localhost',
      health_check_endpoint: getHealthCheckEndpoint(config.service_name)
    };
    
    const { error } = await supabase
      .from('sys_server_ports_registry')
      .upsert({
        service_name: config.service_name,
        ...update
      }, {
        onConflict: 'service_name'
      });
    
    if (error) {
      console.error(`❌ Failed to update ${config.service_name}:`, error.message);
    } else {
      console.log(`✅ Updated ${config.service_name}`);
    }
  }
  
  console.log('\n✅ Registry population complete!');
  console.log('You can now start servers with: pnpm servers');
}

// Run the population
populateRegistry().catch(console.error);