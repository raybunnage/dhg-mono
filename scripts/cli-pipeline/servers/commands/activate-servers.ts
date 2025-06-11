#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function activateServers() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔄 Activating all servers in registry...\n');
  
  // List of core servers to activate
  const coreServers = [
    'md-server',
    'script-server',
    'docs-archive-server',
    'git-server',
    'web-google-drive-audio',
    'local-google-drive-audio',
    'living-docs-server',
    'git-api-server',
    'worktree-switcher',
    'git-history-server',
    'test-runner-server'
  ];
  
  const { error } = await supabase
    .from('sys_server_ports_registry')
    .update({ status: 'active' })
    .in('service_name', coreServers)
    .eq('environment', 'development');
  
  if (error) {
    console.error('❌ Failed to activate servers:', error.message);
    process.exit(1);
  } else {
    console.log('✅ All core servers activated!');
    console.log('You can now start servers with: pnpm servers');
  }
}

// Run activation
activateServers().catch(console.error);