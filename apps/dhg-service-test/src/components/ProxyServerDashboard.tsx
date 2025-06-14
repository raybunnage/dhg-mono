import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProxyServerInfo {
  id: number;
  service_name: string;
  port: number;
  description: string;
  active: boolean;
  metadata: {
    server_type: string;
    proxy_category: string;
    script_path: string;
    base_class: string;
    service_class?: string;
    migrated_from?: string;
  };
  health?: {
    status: 'online' | 'offline' | 'unknown';
    lastChecked: Date;
    error?: string;
  };
}

const CATEGORY_COLORS = {
  infrastructure: 'bg-blue-100 text-blue-800',
  viewer: 'bg-green-100 text-green-800',
  utility: 'bg-purple-100 text-purple-800',
  management: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-600'
};

const STATUS_COLORS = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  unknown: 'bg-gray-400'
};

export function ProxyServerDashboard() {
  const [servers, setServers] = useState<ProxyServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load servers from database
  const loadServers = async () => {
    try {
      const { data, error } = await supabase
        .from('sys_server_ports_registry')
        .select('*')
        .order('port', { ascending: true });

      if (error) throw error;

      // Initialize health status for active proxy servers
      const serversWithHealth = (data || []).map(server => ({
        ...server,
        health: server.active && server.metadata?.server_type === 'proxy' 
          ? { status: 'unknown' as const, lastChecked: new Date() }
          : undefined
      }));

      setServers(serversWithHealth);
      setError(null);
    } catch (err) {
      console.error('Error loading servers:', err);
      setError('Failed to load servers from database');
    } finally {
      setLoading(false);
    }
  };

  // Check health of a single server
  const checkServerHealth = async (server: ProxyServerInfo) => {
    if (!server.active || server.metadata?.server_type !== 'proxy') return;

    try {
      const response = await fetch(`http://localhost:${server.port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });

      const health = {
        status: response.ok ? 'online' : 'offline',
        lastChecked: new Date(),
        error: response.ok ? undefined : `HTTP ${response.status}`
      } as const;

      setServers(prev => 
        prev.map(s => s.id === server.id ? { ...s, health } : s)
      );
    } catch (err) {
      setServers(prev => 
        prev.map(s => s.id === server.id 
          ? { 
              ...s, 
              health: { 
                status: 'offline', 
                lastChecked: new Date(), 
                error: err instanceof Error ? err.message : 'Connection failed'
              } 
            } 
          : s
        )
      );
    }
  };

  // Check health of all active servers
  const checkAllServersHealth = async () => {
    const activeProxies = servers.filter(s => s.active && s.metadata?.server_type === 'proxy');
    await Promise.all(activeProxies.map(server => checkServerHealth(server)));
  };

  // Start a specific proxy server
  const startProxy = (server: ProxyServerInfo) => {
    const command = `pnpm proxy:${server.service_name.replace('-proxy', '')}`;
    alert(`To start this proxy, run:\n\n${command}\n\nOr use "pnpm servers" to start all proxies.`);
  };

  // Get category statistics
  const categoryStats = servers.reduce((acc, server) => {
    const category = server.active 
      ? (server.metadata?.proxy_category || 'other')
      : 'inactive';
    
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter servers by category
  const filteredServers = selectedCategory === 'all' 
    ? servers 
    : selectedCategory === 'inactive'
    ? servers.filter(s => !s.active)
    : servers.filter(s => s.active && s.metadata?.proxy_category === selectedCategory);

  // Auto-refresh health checks
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        checkAllServersHealth();
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, servers]);

  useEffect(() => {
    loadServers();
  }, []);

  // Initial health check after servers load
  useEffect(() => {
    if (servers.length > 0 && servers.some(s => s.active)) {
      checkAllServersHealth();
    }
  }, [servers.length]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Proxy Server Dashboard</h2>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
            <button
              onClick={checkAllServersHealth}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Check Health
            </button>
            <button
              onClick={() => window.open('http://localhost:8080', '_blank')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Open HTML Browser
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({servers.length})
          </button>
          {Object.entries(categoryStats).map(([category, count]) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 rounded p-3">
            <p className="text-sm text-blue-600 font-medium">Active Proxies</p>
            <p className="text-2xl font-bold text-blue-800">
              {servers.filter(s => s.active && s.metadata?.server_type === 'proxy').length}
            </p>
          </div>
          <div className="bg-green-50 rounded p-3">
            <p className="text-sm text-green-600 font-medium">Online</p>
            <p className="text-2xl font-bold text-green-800">
              {servers.filter(s => s.health?.status === 'online').length}
            </p>
          </div>
          <div className="bg-red-50 rounded p-3">
            <p className="text-sm text-red-600 font-medium">Offline</p>
            <p className="text-2xl font-bold text-red-800">
              {servers.filter(s => s.health?.status === 'offline').length}
            </p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-600 font-medium">Inactive/Migrated</p>
            <p className="text-2xl font-bold text-gray-800">
              {servers.filter(s => !s.active).length}
            </p>
          </div>
        </div>
      </div>

      {/* Server List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Port
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredServers.map((server) => (
              <tr key={server.id} className={server.active ? '' : 'opacity-50'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {server.health ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[server.health.status]}`} />
                      <span className="text-sm text-gray-600">
                        {server.health.status}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {server.service_name}
                    </div>
                    {server.metadata?.migrated_from && (
                      <div className="text-xs text-gray-500">
                        (was: {server.metadata.migrated_from})
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-gray-900">{server.port}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    server.active 
                      ? CATEGORY_COLORS[server.metadata?.proxy_category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-800'
                      : CATEGORY_COLORS.inactive
                  }`}>
                    {server.active ? server.metadata?.proxy_category || 'other' : 'inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">{server.description}</p>
                  {server.metadata?.base_class && (
                    <p className="text-xs text-gray-500 mt-1">
                      Base: {server.metadata.base_class}
                      {server.metadata.service_class && ` | Service: ${server.metadata.service_class}`}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {server.active && server.metadata?.server_type === 'proxy' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => checkServerHealth(server)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Check
                      </button>
                      {server.health?.status === 'offline' && (
                        <button
                          onClick={() => startProxy(server)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Start
                        </button>
                      )}
                      {server.port === 8080 && (
                        <button
                          onClick={() => window.open(`http://localhost:${server.port}`, '_blank')}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Launch Command Help */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Launch Commands</h3>
        <div className="space-y-2 font-mono text-sm">
          <p className="text-blue-800">
            <span className="font-bold">Start all proxies:</span> pnpm servers
          </p>
          <p className="text-blue-800">
            <span className="font-bold">Start individual proxy:</span> pnpm proxy:[name]
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Example: pnpm proxy:vite-fix, pnpm proxy:monitoring, pnpm proxy:manager
          </p>
        </div>
      </div>
    </div>
  );
}