#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface ProxyServerRegistryEntry {
  service_name: string;
  display_name: string;
  description: string;
  protocol: 'http' | 'https';
  host: string;
  port: number;
  base_path: string;
  environment: 'development' | 'production' | 'staging';
  status: 'active' | 'inactive';
  health_check_endpoint: string;
  metadata: {
    server_type: 'proxy';
    proxy_category: 'infrastructure' | 'viewer' | 'utility' | 'management';
    script_path: string;
    base_class: string;
    service_class?: string;
  };
}

const PROXY_SERVERS: ProxyServerRegistryEntry[] = [
  {
    service_name: 'vite-fix-proxy',
    display_name: 'Vite Fix Proxy',
    description: 'Handles Vite environment fixes for development',
    protocol: 'http',
    host: 'localhost',
    port: 9876,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-vite-fix-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'ViteFixService'
    }
  },
  {
    service_name: 'continuous-monitoring-proxy',
    display_name: 'Continuous Monitoring Proxy',
    description: 'System health monitoring and metrics collection',
    protocol: 'http',
    host: 'localhost',
    port: 9877,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'infrastructure',
      script_path: 'scripts/cli-pipeline/proxy/start-continuous-monitoring-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'SystemMonitor'
    }
  },
  {
    service_name: 'proxy-manager-proxy',
    display_name: 'Proxy Manager',
    description: 'Manages start/stop/status of other proxy servers',
    protocol: 'http',
    host: 'localhost',
    port: 9878,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'management',
      script_path: 'scripts/cli-pipeline/proxy/start-proxy-manager-proxy.ts',
      base_class: 'BaseProxyServer'
    }
  },
  {
    service_name: 'git-operations-proxy',
    display_name: 'Git Operations Proxy',
    description: 'Git worktree and branch management operations',
    protocol: 'http',
    host: 'localhost',
    port: 9879,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-git-operations-proxy.ts',
      base_class: 'ProxyServerBase',
      service_class: 'GitOperationsService'
    }
  },
  {
    service_name: 'file-browser-proxy',
    display_name: 'File Browser Proxy',
    description: 'File system operations and browsing',
    protocol: 'http',
    host: 'localhost',
    port: 9880,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-file-browser-proxy.ts',
      base_class: 'ProxyServerBase',
      service_class: 'FileBrowserService'
    }
  },
  {
    service_name: 'continuous-docs-proxy',
    display_name: 'Continuous Docs Proxy',
    description: 'Manages continuously updated documentation tracking',
    protocol: 'http',
    host: 'localhost',
    port: 9882,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-continuous-docs-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'ContinuousDocsService'
    }
  },
  {
    service_name: 'audio-streaming-proxy',
    display_name: 'Audio Streaming Proxy',
    description: 'Streams audio files from Google Drive with local fallback',
    protocol: 'http',
    host: 'localhost',
    port: 9883,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-audio-streaming-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'AudioProxyService'
    }
  },
  {
    service_name: 'script-viewer-proxy',
    display_name: 'Script Viewer Proxy',
    description: 'View, archive, and manage script files (.sh, .js, .ts, .py)',
    protocol: 'http',
    host: 'localhost',
    port: 9884,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'viewer',
      script_path: 'scripts/cli-pipeline/proxy/start-script-viewer-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'ScriptViewerService'
    }
  },
  {
    service_name: 'markdown-viewer-proxy',
    display_name: 'Markdown Viewer Proxy',
    description: 'View, archive, and manage markdown files in docs/',
    protocol: 'http',
    host: 'localhost',
    port: 9885,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'viewer',
      script_path: 'scripts/cli-pipeline/proxy/start-markdown-viewer-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'MarkdownViewerService'
    }
  },
  {
    service_name: 'docs-archive-proxy',
    display_name: 'Docs Archive Proxy',
    description: 'Document file management and archiving across project',
    protocol: 'http',
    host: 'localhost',
    port: 9886,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'viewer',
      script_path: 'scripts/cli-pipeline/proxy/start-docs-archive-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'DocsArchiveService'
    }
  },
  {
    service_name: 'worktree-switcher-proxy',
    display_name: 'Worktree Switcher Proxy',
    description: 'Visual UI for switching between git worktrees',
    protocol: 'http',
    host: 'localhost',
    port: 9887,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'utility',
      script_path: 'scripts/cli-pipeline/proxy/start-worktree-switcher-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'WorktreeSwitcherService'
    }
  },
  {
    service_name: 'html-file-browser-proxy',
    display_name: 'HTML File Browser Proxy',
    description: 'Web-based file browser with UI for project navigation',
    protocol: 'http',
    host: 'localhost',
    port: 8080,
    base_path: '',
    environment: 'development',
    status: 'active',
    health_check_endpoint: '/health',
    metadata: {
      server_type: 'proxy',
      proxy_category: 'viewer',
      script_path: 'scripts/cli-pipeline/proxy/start-html-file-browser-proxy.ts',
      base_class: 'BaseProxyServer',
      service_class: 'HtmlFileBrowserService'
    }
  }
];

async function updateServerRegistry() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Updating sys_server_ports_registry with proxy servers...\n');

  for (const server of PROXY_SERVERS) {
    console.log(`Processing ${server.display_name}...`);
    
    // Check if entry already exists
    const { data: existing, error: checkError } = await supabase
      .from('sys_server_ports_registry')
      .select('id')
      .eq('service_name', server.service_name)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`Error checking ${server.service_name}:`, checkError);
      continue;
    }
    
    if (existing) {
      // Update existing entry
      const { error: updateError } = await supabase
        .from('sys_server_ports_registry')
        .update({
          display_name: server.display_name,
          description: server.description,
          port: server.port,
          health_check_endpoint: server.health_check_endpoint,
          metadata: server.metadata,
          status: server.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.error(`Error updating ${server.service_name}:`, updateError);
      } else {
        console.log(`✅ Updated ${server.service_name}`);
      }
    } else {
      // Insert new entry
      const { error: insertError } = await supabase
        .from('sys_server_ports_registry')
        .insert(server);
      
      if (insertError) {
        console.error(`Error inserting ${server.service_name}:`, insertError);
      } else {
        console.log(`✅ Added ${server.service_name}`);
      }
    }
  }
  
  // Clean up old entries that have been migrated
  console.log('\n🧹 Marking old servers as inactive...');
  
  const oldServers = [
    'script-server',      // Migrated to script-viewer-proxy
    'markdown-server',    // Migrated to markdown-viewer-proxy
    'docs-archive-server', // Migrated to docs-archive-proxy
    'git-server',         // Migrated to git-operations-proxy
    'git-api-server',     // Merged into git-operations-proxy
    'continuous-docs-server', // Migrated to continuous-docs-proxy
    'web-google-drive-audio', // Migrated to audio-streaming-proxy
    'worktree-switcher',  // Migrated to worktree-switcher-proxy
    'file-browser'        // Migrated to html-file-browser-proxy
  ];
  
  for (const oldServer of oldServers) {
    const { error } = await supabase
      .from('sys_server_ports_registry')
      .update({
        status: 'inactive',
        metadata: supabase.rpc('jsonb_merge', {
          target: 'metadata',
          source: { migrated_to: oldServer.replace('-server', '-proxy') }
        }),
        updated_at: new Date().toISOString()
      })
      .eq('service_name', oldServer);
    
    if (!error) {
      console.log(`⚫ Marked ${oldServer} as inactive`);
    }
  }
  
  console.log('\n✅ Server registry update complete!');
}

// Run the update
updateServerRegistry().catch(console.error);