import { useState, useEffect } from 'react';
import axios from 'axios';

interface ProxyServerInfo {
  name: string;
  port: number;
  description: string;
  status: 'online' | 'offline' | 'checking';
  healthEndpoint: string;
  lastCheck?: Date;
  responseTime?: number;
  error?: string;
}

const PROXY_SERVERS: ProxyServerInfo[] = [
  {
    name: 'Vite Fix Proxy',
    port: 9876,
    description: 'Vite environment fix commands',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Continuous Monitoring',
    port: 9877,
    description: 'System health monitoring',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Proxy Manager',
    port: 9878,
    description: 'Start/stop/manage other proxies',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Git Operations',
    port: 9879,
    description: 'Git operations and worktree management',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'File Browser',
    port: 9880,
    description: 'File system operations',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Continuous Docs',
    port: 9882,
    description: 'Documentation tracking',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Audio Streaming',
    port: 9883,
    description: 'Audio file streaming from Google Drive',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Script Viewer',
    port: 9884,
    description: 'View/archive/delete script files',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Markdown Viewer',
    port: 9885,
    description: 'View/archive/delete markdown files',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Docs Archive',
    port: 9886,
    description: 'Document file management',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'Worktree Switcher',
    port: 9887,
    description: 'Visual git worktree switcher',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'HTML File Browser',
    port: 8080,
    description: 'Web-based file browser UI',
    status: 'checking',
    healthEndpoint: '/health'
  },
  {
    name: 'CLI Test Runner',
    port: 9890,
    description: 'CLI pipeline test runner for ALPHA/BETA/GAMMA groups',
    status: 'checking',
    healthEndpoint: '/health'
  }
];

export function ProxyServerStatus() {
  const [servers, setServers] = useState<ProxyServerInfo[]>(PROXY_SERVERS);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const checkServerHealth = async (server: ProxyServerInfo): Promise<ProxyServerInfo> => {
    const startTime = Date.now();
    try {
      const response = await axios.get(`http://localhost:${server.port}${server.healthEndpoint}`, {
        timeout: 3000
      });
      
      return {
        ...server,
        status: 'online',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: undefined
      };
    } catch (error) {
      return {
        ...server,
        status: 'offline',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const checkAllServers = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    const updatedServers = await Promise.all(
      servers.map(server => checkServerHealth(server))
    );
    setServers(updatedServers);
    setLastUpdate(new Date());
    setIsChecking(false);
  };

  useEffect(() => {
    checkAllServers();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      checkAllServers();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      case 'checking': return '🟡';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600';
      case 'offline': return 'text-red-600';
      case 'checking': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const onlineCount = servers.filter(s => s.status === 'online').length;
  const offlineCount = servers.filter(s => s.status === 'offline').length;

  const startAllServers = async () => {
    try {
      const response = await axios.post('http://localhost:9878/proxies/start-all');
      console.log('Start all response:', response.data);
      // Wait a bit then refresh status
      setTimeout(checkAllServers, 3000);
    } catch (error) {
      console.error('Failed to start all servers:', error);
      alert('Failed to start servers. Is the Proxy Manager running?');
    }
  };

  const stopAllServers = async () => {
    try {
      const response = await axios.post('http://localhost:9878/proxies/stop-all');
      console.log('Stop all response:', response.data);
      // Wait a bit then refresh status
      setTimeout(checkAllServers, 1000);
    } catch (error) {
      console.error('Failed to stop all servers:', error);
      alert('Failed to stop servers. Is the Proxy Manager running?');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Proxy Server Status</h2>
            <p className="text-gray-600 mt-1">
              Monitor and manage all proxy servers in the DHG monorepo
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Auto-refresh</span>
              </label>
              <button
                onClick={checkAllServers}
                disabled={isChecking}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isChecking ? '🔄 Checking...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Servers</div>
            <div className="text-2xl font-bold">{servers.length}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600">Online</div>
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600">Offline</div>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={startAllServers}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
          >
            🚀 Start All Servers
          </button>
          <button
            onClick={stopAllServers}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
          >
            🛑 Stop All Servers
          </button>
          <button
            onClick={() => window.open('http://localhost:9878/dashboard', '_blank')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
          >
            📊 Proxy Manager Dashboard
          </button>
        </div>

        {/* Server List */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg mb-2">Server Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Port</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Response Time</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr key={server.port} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      <span className={`text-xl ${getStatusColor(server.status)}`}>
                        {getStatusIcon(server.status)}
                      </span>
                    </td>
                    <td className="py-3 font-medium">{server.name}</td>
                    <td className="py-3">{server.port}</td>
                    <td className="py-3 text-sm text-gray-600">{server.description}</td>
                    <td className="py-3 text-sm">
                      {server.responseTime ? `${server.responseTime}ms` : '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.open(`http://localhost:${server.port}`, '_blank')}
                          disabled={server.status !== 'online'}
                          className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Open
                        </button>
                        {server.status === 'online' ? (
                          <button
                            onClick={async () => {
                              try {
                                await axios.post(`http://localhost:9878/proxies/${server.name.toLowerCase().replace(/ /g, '-')}/stop`);
                                setTimeout(checkAllServers, 1000);
                              } catch (error) {
                                console.error('Failed to stop server:', error);
                              }
                            }}
                            className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                await axios.post(`http://localhost:9878/proxies/${server.name.toLowerCase().replace(/ /g, '-')}/start`);
                                setTimeout(checkAllServers, 3000);
                              } catch (error) {
                                console.error('Failed to start server:', error);
                              }
                            }}
                            className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error Details */}
        {servers.some(s => s.error) && (
          <div className="mt-6">
            <h3 className="font-semibold text-lg mb-2">Error Details</h3>
            <div className="space-y-2">
              {servers.filter(s => s.error).map(server => (
                <div key={server.port} className="bg-red-50 p-3 rounded">
                  <div className="font-medium text-red-800">{server.name}</div>
                  <div className="text-sm text-red-600">{server.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-2">Quick Start</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Start all proxy servers: <code className="bg-white px-2 py-1 rounded">pnpm servers</code></li>
          <li>Or start individual proxies from the actions column</li>
          <li>The Proxy Manager (port 9878) must be running to control other servers</li>
          <li>Click "Open" to access any running proxy's interface</li>
        </ol>
      </div>
    </div>
  );
}